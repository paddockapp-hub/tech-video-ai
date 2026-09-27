"""
Authentication Service Module
Firebase, GitHub, Google 로그인 및 사용자 관리
"""

import os
import json
from typing import Dict, Optional, Any
from datetime import datetime, timedelta

# Firebase 인증
try:
    import firebase_admin
    from firebase_admin import credentials, auth
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("Firebase SDK를 사용할 수 없습니다. 인증 기능이 제한됩니다.")

# GitHub 인증
try:
    from requests_oauthlib import OAuth2Session
    GITHUB_OAUTH_AVAILABLE = True
except ImportError:
    GITHUB_OAUTH_AVAILABLE = False
    print("GitHub OAuth를 사용할 수 없습니다. GitHub 인증 기능이 제한됩니다.")


class AuthService:
    def __init__(self, config: Dict):
        self.config = config
        self.firebase_initialized = False
        self.github_session = None
        
        # Firebase 초기화
        if FIREBASE_AVAILABLE and config.get('firebase_enabled', False):
            self._initialize_firebase()
        
        # GitHub OAuth 초기화
        if GITHUB_OAUTH_AVAILABLE and config.get('github_enabled', False):
            self._initialize_github_oauth()
    
    def _initialize_firebase(self):
        """Firebase 초기화"""
        try:
            firebase_key_path = self.config.get('firebase_key_path')
            if firebase_key_path and os.path.exists(firebase_key_path):
                cred = credentials.Certificate(firebase_key_path)
                firebase_admin.initialize_app(cred)
                self.firebase_initialized = True
                print("Firebase 초기화 완료")
            else:
                print("Firebase 키 파일을 찾을 수 없습니다.")
        except Exception as e:
            print(f"Firebase 초기화 실패: {e}")
    
    def _initialize_github_oauth(self):
        """GitHub OAuth 초기화"""
        try:
            client_id = self.config.get('github_client_id')
            client_secret = self.config.get('github_client_secret')
            
            if client_id and client_secret:
                self.github_session = OAuth2Session(
                    client_id,
                    redirect_uri=self.config.get('github_redirect_uri', 'http://localhost:8000/auth/github/callback'),
                    scope=['user:email', 'user:profile']
                )
                print("GitHub OAuth 초기화 완료")
            else:
                print("GitHub OAuth 설정이 부족합니다.")
        except Exception as e:
            print(f"GitHub OAuth 초기화 실패: {e}")
    
    def register_user(self, email: str, password: str, metadata: Dict = None) -> Dict:
        """사용자 등록"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        try:
            # Firebase에 사용자 생성
            user = auth.create_user(
                email=email,
                password=password,
                display_name=metadata.get('display_name', '') if metadata else ''
            )
            
            # 사용자 메타데이터 저장
            if metadata:
                auth.update_user(user.uid, email=email, **metadata)
            
            return {
                'success': True,
                'user_id': user.uid,
                'email': user.email,
                'message': '사용자 등록 완료'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'사용자 등록 실패: {str(e)}'
            }
    
    def login_user(self, email: str, password: str) -> Dict:
        """사용자 로그인"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        try:
            # Firebase 사용자 인증
            user = auth.get_user_by_email(email)
            
            # 사용자 정보 반환
            return {
                'success': True,
                'user_id': user.uid,
                'email': user.email,
                'display_name': user.display_name,
                'message': '로그인 완료'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'로그인 실패: {str(e)}'
            }
    
    def get_github_auth_url(self) -> str:
        """GitHub 인증 URL 생성"""
        
        if not self.github_session:
            return None
        
        try:
            authorization_url = 'https://github.com/login/oauth/authorize'
            auth_url, state = self.github_session.authorization_url(authorization_url)
            return auth_url
        except Exception as e:
            print(f"GitHub 인증 URL 생성 실패: {e}")
            return None
    
    def handle_github_callback(self, code: str) -> Dict:
        """GitHub OAuth 콜백 처리"""
        
        if not self.github_session:
            return {
                'success': False,
                'error': 'GitHub OAuth가 초기화되지 않았습니다.'
            }
        
        try:
            token_url = 'https://github.com/login/oauth/access_token'
            token = self.github_session.fetch_token(token_url, client_secret=self.config.get('github_client_secret'), code=code)
            
            # GitHub 사용자 정보 가져오기
            user_info = self.github_session.get('https://api.github.com/user').json()
            
            return {
                'success': True,
                'user_id': f"github_{user_info['id']}",
                'email': user_info.get('email'),
                'display_name': user_info.get('name', user_info.get('login')),
                'avatar_url': user_info.get('avatar_url'),
                'message': 'GitHub 로그인 완료'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'GitHub 인증 실패: {str(e)}'
            }
    
    def verify_token(self, token: str) -> Dict:
        """토큰 검증"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        try:
            decoded_token = auth.verify_id_token(token)
            return {
                'success': True,
                'user_id': decoded_token['uid'],
                'email': decoded_token.get('email'),
                'verified': True
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'토큰 검증 실패: {str(e)}'
            }
    
    def logout_user(self, user_id: str) -> Dict:
        """사용자 로그아웃"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        try:
            # Firebase 토큰 무효화
            auth.revoke_refresh_tokens(user_id)
            
            return {
                'success': True,
                'message': '로그아웃 완료'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'로그아웃 실패: {str(e)}'
            }
    
    def get_user_info(self, user_id: str) -> Dict:
        """사용자 정보 조회"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        try:
            user = auth.get_user(user_id)
            return {
                'success': True,
                'user_id': user.uid,
                'email': user.email,
                'display_name': user.display_name,
                'photo_url': user.photo_url,
                'email_verified': user.email_verified,
                'metadata': user.custom_claims
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'사용자 정보 조회 실패: {str(e)}'
            }