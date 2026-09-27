"""
Storage Service Module
파일 업로드, 백엔드 저장소 연동 (Firebase Storage, S3, Vercel Blob)
"""

import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import mimetypes

# Firebase Storage
try:
    from firebase_admin import storage
    FIREBASE_STORAGE_AVAILABLE = True
except ImportError:
    FIREBASE_STORAGE_AVAILABLE = False
    print("Firebase Storage를 사용할 수 없습니다.")

# AWS S3
try:
    import boto3
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False
    print("boto3를 사용할 수 없습니다. S3 기능이 제한됩니다.")


class StorageService:
    def __init__(self, config: Dict):
        self.config = config
        self.storage_type = config.get('storage_type', 'local')  # local, firebase, s3, vercel
        self.firebase_storage = None
        self.s3_client = None
        
        # 스토리지 초기화
        if self.storage_type == 'firebase' and FIREBASE_STORAGE_AVAILABLE:
            self._initialize_firebase_storage()
        elif self.storage_type == 's3' and S3_AVAILABLE:
            self._initialize_s3()
        
        # 로컬 저장소 설정
        self.local_storage_dir = config.get('local_storage_dir', 'uploads')
        os.makedirs(self.local_storage_dir, exist_ok=True)
    
    def _initialize_firebase_storage(self):
        """Firebase Storage 초기화"""
        try:
            self.firebase_storage = storage.bucket()
            print("Firebase Storage 초기화 완료")
        except Exception as e:
            print(f"Firebase Storage 초기화 실패: {e}")
    
    def _initialize_s3(self):
        """S3 초기화"""
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.config.get('aws_access_key_id'),
                aws_secret_access_key=self.config.get('aws_secret_access_key'),
                region_name=self.config.get('aws_region', 'us-east-1')
            )
            print("S3 초기화 완료")
        except Exception as e:
            print(f"S3 초기화 실패: {e}")
    
    def upload_file(self, file_path: str, destination: str = None, 
                   metadata: Dict = None) -> Dict:
        """파일 업로드"""
        
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'파일을 찾을 수 없습니다: {file_path}'
            }
        
        file_name = os.path.basename(file_path)
        mime_type, _ = mimetypes.guess_type(file_path)
        
        if destination is None:
            destination = f"uploads/{datetime.now().strftime('%Y%m%d')}/{file_name}"
        
        try:
            if self.storage_type == 'firebase' and self.firebase_storage:
                return self._upload_to_firebase(file_path, destination, metadata)
            elif self.storage_type == 's3' and self.s3_client:
                return self._upload_to_s3(file_path, destination, metadata)
            else:
                return self._upload_to_local(file_path, destination, metadata)
                
        except Exception as e:
            return {
                'success': False,
                'error': f'파일 업로드 실패: {str(e)}'
            }
    
    def _upload_to_firebase(self, file_path: str, destination: str, 
                          metadata: Dict = None) -> Dict:
        """Firebase Storage에 업로드"""
        
        try:
            blob = self.firebase_storage.blob(destination)
            
            # 메타데이터 설정
            if metadata:
                blob.metadata = metadata
            
            # 파일 업로드
            blob.upload_from_filename(file_path)
            
            # URL 생성
            file_url = blob.generate_signed_url(timedelta(days=7))
            
            return {
                'success': True,
                'file_url': file_url,
                'storage_path': destination,
                'storage_type': 'firebase',
                'message': 'Firebase Storage 업로드 완료'
            }
            
        except Exception as e:
            raise Exception(f"Firebase Storage 업로드 실패: {str(e)}")
    
    def _upload_to_s3(self, file_path: str, destination: str, 
                      metadata: Dict = None) -> Dict:
        """S3에 업로드"""
        
        try:
            # S3 버킷 이름
            bucket_name = self.config.get('s3_bucket_name')
            
            # 파일 업로드
            extra_args = {
                'ContentType': mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
            }
            
            if metadata:
                extra_args['Metadata'] = metadata
            
            self.s3_client.upload_file(
                Filename=file_path,
                Bucket=bucket_name,
                Key=destination,
                ExtraArgs=extra_args
            )
            
            # URL 생성
            file_url = f"https://{bucket_name}.s3.amazonaws.com/{destination}"
            
            return {
                'success': True,
                'file_url': file_url,
                'storage_path': destination,
                'storage_type': 's3',
                'message': 'S3 업로드 완료'
            }
            
        except Exception as e:
            raise Exception(f"S3 업로드 실패: {str(e)}")
    
    def _upload_to_local(self, file_path: str, destination: str, 
                       metadata: Dict = None) -> Dict:
        """로컬 저장소에 업로드"""
        
        try:
            # 로컬 저장 경로
            local_path = os.path.join(self.local_storage_dir, destination)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # 파일 복사
            import shutil
            shutil.copy2(file_path, local_path)
            
            # 메타데이터 저장
            if metadata:
                metadata_path = local_path + '.metadata.json'
                with open(metadata_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, ensure_ascii=False)
            
            return {
                'success': True,
                'file_url': local_path,
                'storage_path': destination,
                'storage_type': 'local',
                'message': '로컬 업로드 완료'
            }
            
        except Exception as e:
            raise Exception(f"로컬 업로드 실패: {str(e)}")
    
    def upload_project_files(self, project_id: str, file_paths: List[str]) -> Dict:
        """프로젝트 파일들 업로드"""
        
        results = []
        failed_files = []
        
        for file_path in file_paths:
            result = self.upload_file(
                file_path, 
                f"projects/{project_id}/{os.path.basename(file_path)}",
                {'project_id': project_id, 'uploaded_at': datetime.now().isoformat()}
            )
            
            if result['success']:
                results.append(result)
            else:
                failed_files.append({
                    'file_path': file_path,
                    'error': result.get('error')
                })
        
        return {
            'success': len(failed_files) == 0,
            'uploaded_files': results,
            'failed_files': failed_files,
            'total_files': len(file_paths),
            'uploaded_count': len(results)
        }
    
    def delete_file(self, storage_path: str) -> Dict:
        """파일 삭제"""
        
        try:
            if self.storage_type == 'firebase' and self.firebase_storage:
                blob = self.firebase_storage.blob(storage_path)
                blob.delete()
                return {
                    'success': True,
                    'message': 'Firebase Storage 파일 삭제 완료'
                }
            elif self.storage_type == 's3' and self.s3_client:
                self.s3_client.delete_object(
                    Bucket=self.config.get('s3_bucket_name'),
                    Key=storage_path
                )
                return {
                    'success': True,
                    'message': 'S3 파일 삭제 완료'
                }
            else:
                # 로컬 파일 삭제
                local_path = os.path.join(self.local_storage_dir, storage_path)
                if os.path.exists(local_path):
                    os.remove(local_path)
                    # 메타데이터 파일도 삭제
                    if os.path.exists(local_path + '.metadata.json'):
                        os.remove(local_path + '.metadata.json')
                
                return {
                    'success': True,
                    'message': '로컬 파일 삭제 완료'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'파일 삭제 실패: {str(e)}'
            }
    
    def get_file_info(self, storage_path: str) -> Dict:
        """파일 정보 조회"""
        
        try:
            if self.storage_type == 'firebase' and self.firebase_storage:
                blob = self.firebase_storage.blob(storage_path)
                blob.reload()
                
                return {
                    'success': True,
                    'storage_path': storage_path,
                    'size': blob.size,
                    'content_type': blob.content_type,
                    'updated': blob.updated,
                    'metadata': blob.metadata
                }
            elif self.storage_type == 's3' and self.s3_client:
                response = self.s3_client.head_object(
                    Bucket=self.config.get('s3_bucket_name'),
                    Key=storage_path
                )
                
                return {
                    'success': True,
                    'storage_path': storage_path,
                    'size': response['ContentLength'],
                    'content_type': response['ContentType'],
                    'metadata': response.get('Metadata', {})
                }
            else:
                # 로컬 파일 정보
                local_path = os.path.join(self.local_storage_dir, storage_path)
                if os.path.exists(local_path):
                    return {
                        'success': True,
                        'storage_path': storage_path,
                        'size': os.path.getsize(local_path),
                        'content_type': mimetypes.guess_type(local_path)[0],
                        'updated': datetime.fromtimestamp(os.path.getmtime(local_path)).isoformat()
                    }
                else:
                    return {
                        'success': False,
                        'error': '파일을 찾을 수 없습니다'
                    }
                    
        except Exception as e:
            return {
                'success': False,
                'error': f'파일 정보 조회 실패: {str(e)}'
            }