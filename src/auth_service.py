"""
Authentication Service Module
Firebase and GitHub authentication and user management
"""

from typing import Dict
try:
    from .firebase_utils import initialize_firebase_app
except ImportError:
    from firebase_utils import initialize_firebase_app

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
        self.firebase_app = None
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
            self.firebase_app = initialize_firebase_app(self.config)
            self.firebase_initialized = True
            print("Firebase 초기화 완료")
        except Exception:
            print("Firebase 초기화에 실패했습니다.")
    
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
        except Exception:
            print("GitHub OAuth 초기화에 실패했습니다.")
    
    def register_user(self, email: str, password: str, metadata: Dict = None) -> Dict:
        """사용자 등록"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }

        if not isinstance(email, str) or not email.strip() or not isinstance(password, str) or not password:
            return {'success': False, 'error': 'Email and password are required.'}
        if metadata is not None and not isinstance(metadata, dict):
            return {'success': False, 'error': 'User metadata must be an object.'}
        if metadata and set(metadata) - {'display_name'}:
            return {'success': False, 'error': 'Only the display_name metadata field is supported.'}
        display_name = (metadata or {}).get('display_name')
        if display_name is not None and not isinstance(display_name, str):
            return {'success': False, 'error': 'Display name must be a string.'}

        user = None
        try:
            user = auth.create_user(
                email=email.strip(),
                password=password,
                display_name=display_name or None,
            )
            try:
                custom_token = auth.create_custom_token(user.uid)
                if isinstance(custom_token, bytes):
                    custom_token = custom_token.decode('utf-8')
            except Exception:
                auth.delete_user(user.uid)
                raise
            return {
                'success': True,
                'user_id': user.uid,
                'email': user.email,
                'custom_token': custom_token,
                'message': 'User registered. Exchange the custom token with the Firebase client SDK to sign in.',
            }
        except Exception:
            return {
                'success': False,
                'error': 'User registration failed.',
            }
    
    def login_user(self, id_token: str) -> Dict:
        """Verify the ID token issued after Firebase client-side sign-in."""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        verified = self.verify_token(id_token)
        if not verified.get('success'):
            return verified
        return {
            **verified,
            'message': 'Firebase ID token verified.',
        }
    
    def get_github_auth_url(self) -> str:
        """GitHub 인증 URL 생성"""
        
        if not self.github_session:
            return None
        
        try:
            authorization_url = 'https://github.com/login/oauth/authorize'
            auth_url, state = self.github_session.authorization_url(authorization_url)
            return auth_url
        except Exception:
            print("GitHub 인증 URL 생성에 실패했습니다.")
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
            
        except Exception:
            return {
                'success': False,
                'error': 'GitHub authentication failed.',
            }
    
    def verify_token(self, token: str) -> Dict:
        """토큰 검증"""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        if not isinstance(token, str) or not token.strip():
            return {'success': False, 'error': 'A Firebase ID token is required.'}

        try:
            decoded_token = auth.verify_id_token(token.strip(), check_revoked=True)
            return {
                'success': True,
                'user_id': decoded_token['uid'],
                'email': decoded_token.get('email'),
                'verified': True
            }
        except Exception:
            return {
                'success': False,
                'error': 'Firebase ID token is invalid or expired.',
            }
    
    def logout_user(self, id_token: str) -> Dict:
        """Revoke refresh tokens for the authenticated user."""
        
        if not self.firebase_initialized:
            return {
                'success': False,
                'error': 'Firebase가 초기화되지 않았습니다.'
            }
        
        verified = self.verify_token(id_token)
        if not verified.get('success'):
            return verified
        try:
            auth.revoke_refresh_tokens(verified['user_id'])
            return {'success': True, 'message': 'Logout completed.'}
        except Exception:
            return {
                'success': False,
                'error': 'Logout failed.',
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
        except Exception:
            return {
                'success': False,
                'error': 'User information lookup failed.',
            }