"""
Web Server Module
OAuth 콜백 및 API 서버 (Flask 기반)
"""

import os
import json
from typing import Dict
from functools import wraps

# Flask import
try:
    from flask import Flask, request, jsonify, session
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    print("Flask를 사용할 수 없습니다. 웹 서버 기능이 제한됩니다.")


class WebServer:
    def __init__(self, config: Dict):
        self.config = config
        self.app = None
        
        if not FLASK_AVAILABLE:
            print("웹 서버 기능을 사용할 수 없습니다. Flask가 설치되지 않았습니다.")
            return
        
        try:
            self.app = Flask(__name__)
            self.app.secret_key = config.get('secret_key', 'engineering-shorts-secret')
            
            # CORS 설정
            self.app.config['CORS_HEADERS'] = 'Content-Type'
            
            # 서비스 초기화
            self._init_services()
            
            # 라우트 설정
            self._setup_routes()
            
        except Exception as e:
            print(f"웹 서버 초기화 실패: {e}")
            self.app = None
    
    def _init_services(self):
        """서비스 초기화"""
        from auth_service import AuthService
        from storage_service import StorageService
        
        self.auth_service = AuthService(self.config)
        self.storage_service = StorageService(self.config)
    
    def _setup_routes(self):
        """라우트 설정"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({'status': 'healthy', 'service': 'engineering-shorts-generator'})
        
        @self.app.route('/auth/register', methods=['POST'])
        def register():
            data = request.json
            email = data.get('email')
            password = data.get('password')
            metadata = data.get('metadata', {})
            
            result = self.auth_service.register_user(email, password, metadata)
            return jsonify(result)
        
        @self.app.route('/auth/login', methods=['POST'])
        def login():
            data = request.json
            email = data.get('email')
            password = data.get('password')
            
            result = self.auth_service.login_user(email, password)
            return jsonify(result)
        
        @self.app.route('/auth/github', methods=['GET'])
        def github_auth():
            auth_url = self.auth_service.get_github_auth_url()
            if auth_url:
                return jsonify({'success': True, 'auth_url': auth_url})
            else:
                return jsonify({'success': False, 'error': 'GitHub OAuth가 초기화되지 않았습니다.'})
        
        @self.app.route('/auth/github/callback', methods=['GET'])
        def github_callback():
            code = request.args.get('code')
            result = self.auth_service.handle_github_callback(code)
            return jsonify(result)
        
        @self.app.route('/auth/verify', methods=['POST'])
        def verify_token():
            data = request.json
            token = data.get('token')
            
            result = self.auth_service.verify_token(token)
            return jsonify(result)
        
        @self.app.route('/auth/logout', methods=['POST'])
        def logout():
            data = request.json
            user_id = data.get('user_id')
            
            result = self.auth_service.logout_user(user_id)
            return jsonify(result)
        
        @self.app.route('/storage/upload', methods=['POST'])
        def upload_file():
            if 'file' not in request.files:
                return jsonify({'success': False, 'error': '파일이 없습니다.'})
            
            file = request.files['file']
            destination = request.form.get('destination')
            metadata = json.loads(request.form.get('metadata', '{}'))
            
            # 임시 파일 저장
            temp_path = os.path.join(self.config.get('temp_dir', 'temp'), file.filename)
            file.save(temp_path)
            
            result = self.storage_service.upload_file(temp_path, destination, metadata)
            
            # 임시 파일 삭제
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            return jsonify(result)
        
        @self.app.route('/storage/project/<project_id>', methods=['POST'])
        def upload_project_files(project_id):
            if 'files' not in request.files:
                return jsonify({'success': False, 'error': '파일이 없습니다.'})
            
            files = request.files.getlist('files')
            temp_paths = []
            
            # 임시 파일 저장
            for file in files:
                temp_path = os.path.join(self.config.get('temp_dir', 'temp'), file.filename)
                file.save(temp_path)
                temp_paths.append(temp_path)
            
            result = self.storage_service.upload_project_files(project_id, temp_paths)
            
            # 임시 파일 삭제
            for temp_path in temp_paths:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            
            return jsonify(result)
        
        @self.app.route('/storage/file/<path:storage_path>', methods=['GET'])
        def get_file_info(storage_path):
            result = self.storage_service.get_file_info(storage_path)
            return jsonify(result)
        
        @self.app.route('/storage/file/<path:storage_path>', methods=['DELETE'])
        def delete_file(storage_path):
            result = self.storage_service.delete_file(storage_path)
            return jsonify(result)
    
    def run(self, host='0.0.0.0', port=8000, debug=False):
        """서버 실행"""
        if self.app:
            print(f"웹 서버 시작: http://{host}:{port}")
            self.app.run(host=host, port=port, debug=debug)
        else:
            print("Flask를 사용할 수 없어 서버를 시작할 수 없습니다.")