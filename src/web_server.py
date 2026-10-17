"""
Web Server Module
OAuth 콜백 및 API 서버 (Flask 기반)
"""

import os
import json
import tempfile
import hmac
from typing import Dict

# Flask import
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
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
            self.app.secret_key = config.get('secret_key')
            
            # CORS 설정
            CORS(self.app)
            
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
        from ollama_service import OllamaService
        
        self.auth_service = AuthService(self.config)
        self.storage_service = StorageService(self.config)
        
        # Ollama 서비스 초기화
        ollama_host = self.config.get('ollama_host', 'http://localhost:11434')
        ollama_model = self.config.get('ollama_model', 'llama3.2:latest')
        self.ollama_service = OllamaService(host=ollama_host, model=ollama_model)
    
    def _setup_routes(self):
        """라우트 설정"""
        def authenticated_user():
            authorization = request.headers.get('Authorization', '')
            scheme, separator, token = authorization.partition(' ')
            if not separator or scheme.lower() != 'bearer' or not token.strip():
                return None, (jsonify({'success': False, 'error': 'Bearer authentication is required.'}), 401)
            if not getattr(self.auth_service, 'firebase_initialized', False):
                return None, (jsonify({'success': False, 'error': 'Firebase authentication is unavailable.'}), 503)
            result = self.auth_service.verify_token(token.strip())
            if not result.get('success'):
                return None, (jsonify({'success': False, 'error': 'Invalid or expired Firebase ID token.'}), 401)
            return result['user_id'], None

        def authorized_api_request():
            authorization = request.headers.get('Authorization', '')
            scheme, separator, token = authorization.partition(' ')
            if not separator or scheme.lower() != 'bearer' or not token.strip():
                return jsonify({'success': False, 'error': 'Bearer authentication is required.'}), 401
            token = token.strip()
            expected_token = self.config.get('auth_token')
            if isinstance(expected_token, str) and expected_token and hmac.compare_digest(token, expected_token):
                return None
            if getattr(self.auth_service, 'firebase_initialized', False):
                identity = self.auth_service.verify_token(token)
                if identity.get('success'):
                    return None
            return jsonify({'success': False, 'error': 'Invalid API credential.'}), 401

        def owns_storage_path(user_id, storage_path):
            if not isinstance(storage_path, str):
                return False
            parts = storage_path.replace('\\', '/').strip('/').split('/')
            return (
                len(parts) >= 3
                and parts[0] in {'users', 'videos', 'audio', 'projects'}
                and parts[1] == user_id
                and all(part not in {'', '.', '..'} for part in parts)
            )
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({'status': 'healthy', 'service': 'engineering-shorts-generator'})
        
        @self.app.route('/auth/register', methods=['POST'])
        def register():
            data = request.get_json(silent=True) or {}
            if not isinstance(data, dict):
                return jsonify({'success': False, 'error': 'A JSON object is required.'}), 400
            email = data.get('email')
            password = data.get('password')
            metadata = data.get('metadata', {})
            result = self.auth_service.register_user(email, password, metadata)
            return jsonify(result), 201 if result.get('success') else 400
        
        @self.app.route('/auth/login', methods=['POST'])
        def login():
            data = request.get_json(silent=True) or {}
            if not isinstance(data, dict) or not data.get('id_token'):
                return jsonify({
                    'success': False,
                    'error': 'Sign in with the Firebase client SDK, then submit its ID token.',
                }), 400
            result = self.auth_service.login_user(data['id_token'])
            return jsonify(result), 200 if result.get('success') else 401
        
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
            if not code:
                return jsonify({'success': False, 'error': 'GitHub authorization code is required.'}), 400
            result = self.auth_service.handle_github_callback(code)
            return jsonify(result), 200 if result.get('success') else 401
        
        @self.app.route('/auth/verify', methods=['POST'])
        def verify_token():
            data = request.get_json(silent=True) or {}
            if not isinstance(data, dict):
                return jsonify({'success': False, 'error': 'A JSON object is required.'}), 400
            token = data.get('token')
            result = self.auth_service.verify_token(token)
            return jsonify(result), 200 if result.get('success') else 401
        
        @self.app.route('/auth/logout', methods=['POST'])
        def logout():
            authorization = request.headers.get('Authorization', '')
            scheme, separator, token = authorization.partition(' ')
            if not separator or scheme.lower() != 'bearer' or not token.strip():
                return jsonify({'success': False, 'error': 'Bearer authentication is required.'}), 401
            result = self.auth_service.logout_user(token.strip())
            return jsonify(result), 200 if result.get('success') else 401
        
        @self.app.route('/storage/upload', methods=['POST'])
        def upload_file():
            user_id, error_response = authenticated_user()
            if error_response:
                return error_response
            if 'file' not in request.files:
                return jsonify({'success': False, 'error': 'A file is required.'}), 400
            
            file = request.files['file']
            from werkzeug.utils import secure_filename
            filename = secure_filename(file.filename or '')
            if not filename:
                return jsonify({'success': False, 'error': 'A valid filename is required.'}), 400
            destination = request.form.get('destination') or f'users/{user_id}/uploads/{filename}'
            if not owns_storage_path(user_id, destination):
                return jsonify({'success': False, 'error': 'Storage path is outside the authenticated user namespace.'}), 403
            try:
                metadata = json.loads(request.form.get('metadata', '{}'))
            except (TypeError, ValueError):
                return jsonify({'success': False, 'error': 'Metadata must be valid JSON.'}), 400
            if not isinstance(metadata, dict):
                return jsonify({'success': False, 'error': 'Metadata must be a JSON object.'}), 400
            if any(
                not isinstance(key, str) or not isinstance(value, str)
                for key, value in metadata.items()
            ):
                return jsonify({'success': False, 'error': 'Metadata keys and values must be strings.'}), 400
            metadata['user_id'] = user_id

            temp_dir = self.config.get('temp_dir', 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            temp_path = None
            try:
                with tempfile.NamedTemporaryFile(
                    dir=temp_dir,
                    suffix=os.path.splitext(filename)[1],
                    delete=False,
                ) as temp_file:
                    temp_path = temp_file.name
                file.save(temp_path)
                result = self.storage_service.upload_file(temp_path, destination, metadata)
                return jsonify(result), 200 if result.get('success') else 502
            finally:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
        
        @self.app.route('/storage/project/<project_id>', methods=['POST'])
        def upload_project_files(project_id):
            user_id, error_response = authenticated_user()
            if error_response:
                return error_response
            if project_id != user_id:
                return jsonify({'success': False, 'error': 'Project uploads are limited to the authenticated user ID.'}), 403
            if 'files' not in request.files:
                return jsonify({'success': False, 'error': 'At least one file is required.'}), 400
            
            files = request.files.getlist('files')
            temp_paths = []
            filenames = []
            upload_results = []
            temp_dir = self.config.get('temp_dir', 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            try:
                from werkzeug.utils import secure_filename
                for file in files:
                    filename = secure_filename(file.filename or '')
                    if not filename:
                        continue
                    with tempfile.NamedTemporaryFile(
                        dir=temp_dir,
                        suffix=os.path.splitext(filename)[1],
                        delete=False,
                    ) as temp_file:
                        temp_paths.append(temp_file.name)
                    filenames.append(filename)
                    file.save(temp_paths[-1])
                if not temp_paths:
                    return jsonify({'success': False, 'error': 'At least one valid file is required.'}), 400
                for index, (temp_path, filename) in enumerate(zip(temp_paths, filenames)):
                    uploaded = self.storage_service.upload_file(
                        temp_path,
                        f'projects/{project_id}/{index}-{filename}',
                        {'project_id': project_id},
                    )
                    upload_results.append(uploaded)
                failed_files = [result for result in upload_results if not result.get('success')]
                result = {
                    'success': not failed_files,
                    'uploaded_files': [item for item in upload_results if item.get('success')],
                    'failed_files': failed_files,
                    'total_files': len(upload_results),
                    'uploaded_count': len(upload_results) - len(failed_files),
                }
                return jsonify(result), 200 if result.get('success') else 502
            finally:
                for temp_path in temp_paths:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
        
        @self.app.route('/storage/file/<path:storage_path>', methods=['GET'])
        def get_file_info(storage_path):
            user_id, error_response = authenticated_user()
            if error_response:
                return error_response
            if not owns_storage_path(user_id, storage_path):
                return jsonify({'success': False, 'error': 'Storage path is outside the authenticated user namespace.'}), 403
            result = self.storage_service.get_file_info(storage_path)
            return jsonify(result), 200 if result.get('success') else 404
        
        @self.app.route('/storage/file/<path:storage_path>', methods=['DELETE'])
        def delete_file(storage_path):
            user_id, error_response = authenticated_user()
            if error_response:
                return error_response
            if not owns_storage_path(user_id, storage_path):
                return jsonify({'success': False, 'error': 'Storage path is outside the authenticated user namespace.'}), 403
            result = self.storage_service.delete_file(storage_path)
            return jsonify(result), 200 if result.get('success') else 502
        
        # Ollama API 엔드포인트
        @self.app.route('/ollama/generate', methods=['POST'])
        def ollama_generate():
            """Ollama 텍스트 생성 API"""
            auth_error = authorized_api_request()
            if auth_error:
                return auth_error
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify({'success': False, 'error': 'A JSON object is required.'}), 400
            prompt = data.get('prompt', '')
            model = data.get('model', None)
            
            if not isinstance(prompt, str) or not prompt.strip():
                return jsonify({'success': False, 'error': 'A prompt is required.'}), 400
            if model is not None and not isinstance(model, str):
                return jsonify({'success': False, 'error': 'Model must be a string.'}), 400
            
            try:
                result = self.ollama_service.generate_text(prompt, model)
                used_ollama = self.ollama_service.last_generation_source == 'ollama'
                return jsonify({
                    'success': used_ollama,
                    'response': result,
                    'model': self.ollama_service.model if used_ollama else None,
                    'source': self.ollama_service.last_generation_source,
                    'error': self.ollama_service.last_error,
                })
            except Exception:
                return jsonify({'success': False, 'error': 'Ollama generation failed.'}), 502
        
        @self.app.route('/ollama/analyze-script', methods=['POST'])
        def ollama_analyze_script():
            """Ollama 스크립트 분석 API"""
            auth_error = authorized_api_request()
            if auth_error:
                return auth_error
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify({'success': False, 'error': 'A JSON object is required.'}), 400
            script_text = data.get('script_text', '')
            num_keyframes = data.get('num_keyframes', 15)
            
            if not isinstance(script_text, str) or not script_text.strip():
                return jsonify({'success': False, 'error': 'Script text is required.'}), 400
            if type(num_keyframes) is not int or not 1 <= num_keyframes <= 15:
                return jsonify({'success': False, 'error': 'num_keyframes must be an integer from 1 to 15.'}), 400
            
            try:
                result = self.ollama_service.analyze_script_for_images(script_text, num_keyframes)
                used_ollama = self.ollama_service.last_analysis_source == 'ollama'
                return jsonify({
                    'success': used_ollama,
                    'keyframes': result,
                    'num_keyframes': len(result),
                    'source': self.ollama_service.last_analysis_source,
                    'error': self.ollama_service.last_error,
                })
            except Exception:
                return jsonify({'success': False, 'error': 'Ollama analysis failed.'}), 502
        
        @self.app.route('/ollama/status', methods=['GET'])
        def ollama_status():
            """Ollama 연결 상태 확인"""
            auth_error = authorized_api_request()
            if auth_error:
                return auth_error
            try:
                is_connected = self.ollama_service.check_connection()
                available_models = self.ollama_service.get_available_models()
                
                return jsonify({
                    'success': is_connected,
                    'connected': is_connected,
                    'model': self.ollama_service.model if is_connected else None,
                    'available_models': available_models,
                    'status': self.ollama_service.status,
                    'source': self.ollama_service.selected_candidate.get('source') if is_connected else None,
                    'candidates': self.ollama_service.candidate_statuses,
                })
            except Exception:
                return jsonify({'success': False, 'error': 'Ollama status check failed.'}), 502
    
    def run(self, host='0.0.0.0', port=8000, debug=False):
        """서버 실행"""
        if self.app:
            print(f"웹 서버 시작: http://{host}:{port}")
            self.app.run(host=host, port=port, debug=debug)
        else:
            print("Flask를 사용할 수 없어 서버를 시작할 수 없습니다.")