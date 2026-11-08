"""
Web Server Module
OAuth 콜백 및 API 서버 (Flask 기반)
"""

import os
import json
import tempfile
import hmac
import re
import shutil
import threading
import uuid
from typing import Dict

# Flask import
try:
    from flask import Flask, request, jsonify, send_file
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
            self.generated_videos = {}
            self.generated_videos_lock = threading.Lock()
            
            # CORS 설정
            CORS(self.app)
            
            # 서비스 초기화
            self._init_services()
            
            # 라우트 설정
            self._setup_routes()
            
        except Exception as e:
            print(f"웹 서버 초기화 실패: {e}")
            self.app = None

    @staticmethod
    def _format_srt_timestamp(seconds):
        milliseconds_total = max(0, int(round(float(seconds) * 1000)))
        hours, remainder = divmod(milliseconds_total, 3_600_000)
        minutes, remainder = divmod(remainder, 60_000)
        whole_seconds, milliseconds = divmod(remainder, 1000)
        return (
            f'{hours:02d}:{minutes:02d}:{whole_seconds:02d},'
            f'{milliseconds:03d}'
        )
    
    def _init_services(self):
        """서비스 초기화"""
        from auth_service import AuthService
        from storage_service import StorageService
        from ollama_service import OllamaService
        from local_main import EngineeringShortsGenerator
        
        self.auth_service = AuthService(self.config)
        self.storage_service = StorageService(self.config)
        
        # Ollama 서비스 초기화
        ollama_host = self.config.get('ollama_host', 'http://localhost:11434')
        ollama_model = self.config.get('ollama_model', 'llama3.2:latest')
        self.ollama_service = OllamaService(host=ollama_host, model=ollama_model)
        self.video_generator_class = EngineeringShortsGenerator
    
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

        @self.app.route('/', methods=['GET'])
        def studio():
            from flask import send_from_directory
            return send_from_directory(
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public'),
                'index.html',
            )

        @self.app.route('/api/generate', methods=['POST'])
        def generate_video():
            auth_error = authorized_api_request()
            if auth_error:
                return auth_error
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify({'success': False, 'error': 'A JSON object is required.'}), 400
            title = data.get('title')
            idea = data.get('idea')
            if (
                not isinstance(title, str)
                or not title.strip()
                or len(title.strip()) > 100
                or any(ord(char) < 32 for char in title)
            ):
                return jsonify({'success': False, 'error': 'Title must contain 1 to 100 characters.'}), 400
            if not isinstance(idea, str) or not 10 <= len(idea.strip()) <= 4000:
                return jsonify({'success': False, 'error': 'Script must contain 10 to 4,000 characters.'}), 400
            if not hasattr(self, 'video_generator_class'):
                return jsonify({'success': False, 'error': 'Video generation is unavailable.'}), 503

            job_id = uuid.uuid4().hex
            output_root = os.path.abspath(self.config.get('output_dir', 'output'))
            temp_root = os.path.abspath(self.config.get('temp_dir', 'temp'))
            job_output_dir = os.path.join(output_root, 'web-jobs', f'{job_id}-output')
            job_temp_dir = os.path.join(temp_root, 'web-jobs', f'{job_id}-temp')
            os.makedirs(job_temp_dir, exist_ok=True)
            script_path = os.path.join(job_temp_dir, 'script.md')
            with open(script_path, 'w', encoding='utf-8') as script_file:
                script_file.write(f"# {title.strip()}\n\n{idea.strip()}\n")

            try:
                generator_config = dict(self.config)
                generator_config.update({
                    'output_dir': job_output_dir,
                    'temp_dir': job_temp_dir,
                })
                generator = self.video_generator_class(config_override=generator_config)
                result = generator.generate_full_video(script_path)
                video_path = result.get('video_file') if isinstance(result, dict) else None
                valid_mp4 = False
                safe_video_path = None
                if isinstance(video_path, str) and os.path.isfile(video_path):
                    safe_video_path = os.path.realpath(video_path)
                    job_output_root = os.path.realpath(job_output_dir)
                    if os.path.commonpath((job_output_root, safe_video_path)) == job_output_root:
                        with open(safe_video_path, 'rb') as video_file:
                            valid_mp4 = video_file.read(12)[4:8] == b'ftyp'
                    else:
                        safe_video_path = None
                if (
                    not isinstance(result, dict)
                    or result.get('success') is not True
                    or not safe_video_path
                    or os.path.getsize(safe_video_path) == 0
                    or not valid_mp4
                ):
                    return jsonify({
                        'success': False,
                        'status': 'failed',
                        'error': 'Video generation did not produce a valid MP4.',
                    }), 502

                subtitles = result.get('subtitles')
                if not isinstance(subtitles, list):
                    subtitles = []
                subtitles_path = os.path.join(
                    os.path.dirname(safe_video_path),
                    'subtitles.srt',
                )
                with open(subtitles_path, 'w', encoding='utf-8') as subtitle_file:
                    for index, cue in enumerate(subtitles, start=1):
                        if not isinstance(cue, dict):
                            continue
                        cue_text = cue.get('text')
                        if not isinstance(cue_text, str) or not cue_text.strip():
                            continue
                        start = max(0.0, float(cue.get('start', 0)))
                        end = max(start, float(cue.get('end', start)))
                        if end <= start:
                            continue
                        subtitle_file.write(
                            f'{index}\n'
                            f'{self._format_srt_timestamp(start)} --> '
                            f'{self._format_srt_timestamp(end)}\n'
                            f'{cue_text.strip()}\n\n'
                        )
                caption_path = os.path.join(
                    os.path.dirname(safe_video_path),
                    'caption.txt',
                )
                caption = f"{title.strip()}\n\n#공학 #과학 #Shorts"
                with open(caption_path, 'w', encoding='utf-8-sig') as caption_file:
                    caption_file.write(caption)

                with self.generated_videos_lock:
                    self.generated_videos[job_id] = safe_video_path
                audio_used_fallback = bool(result.get('audio_used_fallback', result.get('used_fallback', False)))
                requested_storage_type = getattr(
                    self.storage_service,
                    'storage_type',
                    self.config.get('storage_type', 'local'),
                )
                saved_storage_type = 'local'
                storage_status = 'saved-locally'
                storage_fallback_used = False
                storage_error = None
                persistent_artifact_urls = {}
                if requested_storage_type != 'local':
                    try:
                        stored = self.storage_service.upload_file(
                            safe_video_path,
                            f'videos/web/{job_id}.mp4',
                            {'title': title.strip(), 'job_id': job_id},
                        )
                    except Exception:
                        stored = {'success': False}
                    if isinstance(stored, dict) and stored.get('success') is True:
                        saved_storage_type = stored.get('storage_type', requested_storage_type)
                        storage_fallback_used = bool(stored.get('fallback_used'))
                        storage_status = (
                            'saved-locally-fallback'
                            if storage_fallback_used or saved_storage_type == 'local'
                            else 'uploaded'
                        )
                        if storage_fallback_used or saved_storage_type == 'local':
                            storage_error = 'storage-provider-unavailable'
                        elif (
                            saved_storage_type == 'vercel'
                            and isinstance(stored.get('file_url'), str)
                        ):
                            persistent_artifact_urls['video'] = stored['file_url']
                    else:
                        storage_fallback_used = True
                        storage_status = 'saved-locally-fallback'
                        storage_error = 'storage-upload-failed'
                if saved_storage_type == 'vercel' and 'video' in persistent_artifact_urls:
                    for artifact_name, artifact_path in (
                        ('subtitles', subtitles_path),
                        ('caption', caption_path),
                    ):
                        try:
                            artifact_result = self.storage_service.upload_file(
                                artifact_path,
                                f'videos/web/{job_id}/{artifact_name}'
                                f'{os.path.splitext(artifact_path)[1]}',
                                {'title': title.strip(), 'job_id': job_id},
                            )
                        except Exception:
                            artifact_result = {'success': False}
                        artifact_url = (
                            artifact_result.get('file_url')
                            if isinstance(artifact_result, dict)
                            and artifact_result.get('success') is True
                            else None
                        )
                        if isinstance(artifact_url, str) and artifact_url:
                            persistent_artifact_urls[artifact_name] = artifact_url
                        else:
                            storage_fallback_used = True
                            storage_status = 'saved-locally-fallback'
                            storage_error = 'storage-upload-failed'
                if (
                    self.config.get('require_persistent_storage')
                    and not {'video', 'subtitles', 'caption'}.issubset(
                        persistent_artifact_urls
                    )
                ):
                    return jsonify({
                        'success': False,
                        'status': 'failed',
                        'error': 'Persistent video storage is unavailable.',
                    }), 503
                pipeline_status = 'completed_with_fallback' if (
                    result.get('status') == 'completed_with_fallback'
                    or storage_fallback_used
                ) else 'completed'
                image_result = result.get('image_result')
                if not isinstance(image_result, dict):
                    image_result = {}
                return jsonify({
                    'success': True,
                    'status': pipeline_status,
                    'title': title.strip(),
                    'script': idea.strip(),
                    'video_url': persistent_artifact_urls.get(
                        'video',
                        f'/generated/{job_id}',
                    ),
                    'caption': caption,
                    'caption_url': persistent_artifact_urls.get(
                        'caption',
                        f'/generated/{job_id}/caption.txt',
                    ),
                    'subtitles_url': persistent_artifact_urls.get(
                        'subtitles',
                        f'/generated/{job_id}/subtitles.srt',
                    ),
                    'subtitles_burned_in': result.get(
                        'subtitles_burned_in',
                        bool(subtitles),
                    ),
                    'subtitle_timing': result.get(
                        'subtitle_timing',
                        'estimated-from-script-length',
                    ),
                    'visual_source': result.get('visual_source', 'motion-graphics'),
                    'video_effects': ['scene-image-parallax'] if result.get(
                        'visual_source'
                    ) == 'scene-artwork-with-parallax' else ['animated-motion-graphics'],
                    'hashtags': ['#공학', '#과학', '#Shorts'],
                    'audio_provider': result.get('audio_provider'),
                    'audio_used_fallback': audio_used_fallback,
                    'used_fallback': audio_used_fallback,
                    'audio_error': result.get('audio_error'),
                    'ai_source': image_result.get('ai_source'),
                    'ai_error': image_result.get('ai_error'),
                    'image_source': image_result.get('image_source'),
                    'image_error': image_result.get('image_error'),
                    'storage_status': storage_status,
                    'storage_type': saved_storage_type,
                    'storage_fallback_used': storage_fallback_used,
                    'storage_error': storage_error,
                })
            except Exception:
                return jsonify({
                    'success': False,
                    'status': 'failed',
                    'error': 'Video generation could not be completed. Check service availability and server logs.',
                }), 502
            finally:
                if os.path.isdir(job_temp_dir):
                    shutil.rmtree(job_temp_dir)

        @self.app.route('/generated/<job_id>', methods=['GET'])
        def get_generated_video(job_id):
            if not re.fullmatch(r'[0-9a-f]{32}', job_id):
                return jsonify({'success': False, 'error': 'Generated video not found.'}), 404
            with self.generated_videos_lock:
                video_path = self.generated_videos.get(job_id)
            if not video_path or not os.path.isfile(video_path):
                return jsonify({'success': False, 'error': 'Generated video not found.'}), 404
            response = send_file(video_path, mimetype='video/mp4', as_attachment=False)
            response.headers['Cache-Control'] = 'private, no-store'
            return response

        @self.app.route('/generated/<job_id>/<artifact_name>', methods=['GET'])
        def get_generated_artifact(job_id, artifact_name):
            if (
                not re.fullmatch(r'[0-9a-f]{32}', job_id)
                or artifact_name not in {'subtitles.srt', 'caption.txt'}
            ):
                return jsonify({'success': False, 'error': 'Generated file not found.'}), 404
            with self.generated_videos_lock:
                video_path = self.generated_videos.get(job_id)
            if not video_path or not os.path.isfile(video_path):
                return jsonify({'success': False, 'error': 'Generated file not found.'}), 404
            artifact_path = os.path.join(os.path.dirname(video_path), artifact_name)
            if not os.path.isfile(artifact_path):
                return jsonify({'success': False, 'error': 'Generated file not found.'}), 404
            return send_file(
                artifact_path,
                mimetype='text/plain; charset=utf-8',
                as_attachment=True,
                download_name=artifact_name,
            )
        
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