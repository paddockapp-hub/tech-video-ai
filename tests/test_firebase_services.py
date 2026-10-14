import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from src.auth_service import AuthService
from src import firebase_utils
from src.integrated_main import IntegratedSystem
from src.storage_service import StorageService


class FirebaseAuthServiceTests(unittest.TestCase):
    @patch('src.auth_service.initialize_firebase_app', return_value=object())
    @patch('src.auth_service.FIREBASE_AVAILABLE', True)
    @patch('src.auth_service.auth')
    def test_registration_returns_custom_token_and_only_updates_display_name(
        self, firebase_auth, _initialize
    ):
        firebase_auth.create_user.return_value = SimpleNamespace(
            uid='user-1',
            email='person@example.com',
        )
        firebase_auth.create_custom_token.return_value = b'custom-token'

        service = AuthService({'firebase_enabled': True})
        result = service.register_user(
            ' person@example.com ',
            'a valid password',
            {'display_name': 'Person'},
        )

        self.assertTrue(result['success'])
        self.assertEqual(result['custom_token'], 'custom-token')
        firebase_auth.create_user.assert_called_once_with(
            email='person@example.com',
            password='a valid password',
            display_name='Person',
        )
        firebase_auth.update_user.assert_not_called()

    @patch('src.auth_service.initialize_firebase_app', return_value=object())
    @patch('src.auth_service.FIREBASE_AVAILABLE', True)
    @patch('src.auth_service.auth')
    def test_login_verifies_id_token_instead_of_only_looking_up_email(
        self, firebase_auth, _initialize
    ):
        firebase_auth.verify_id_token.return_value = {
            'uid': 'user-1',
            'email': 'person@example.com',
        }
        service = AuthService({'firebase_enabled': True})

        result = service.login_user('firebase-id-token')

        self.assertTrue(result['success'])
        self.assertEqual(result['user_id'], 'user-1')
        firebase_auth.verify_id_token.assert_called_once_with(
            'firebase-id-token',
            check_revoked=True,
        )
        firebase_auth.get_user_by_email.assert_not_called()

    @patch('src.auth_service.initialize_firebase_app', return_value=object())
    @patch('src.auth_service.FIREBASE_AVAILABLE', True)
    @patch('src.auth_service.auth')
    def test_logout_revokes_only_the_identity_from_a_verified_token(
        self, firebase_auth, _initialize
    ):
        firebase_auth.verify_id_token.return_value = {'uid': 'verified-user'}
        service = AuthService({'firebase_enabled': True})

        result = service.logout_user('valid-id-token')

        self.assertTrue(result['success'])
        firebase_auth.revoke_refresh_tokens.assert_called_once_with('verified-user')

    @patch('src.auth_service.initialize_firebase_app', return_value=object())
    @patch('src.auth_service.FIREBASE_AVAILABLE', True)
    @patch('src.auth_service.auth')
    def test_registration_rejects_privileged_metadata(self, firebase_auth, _initialize):
        service = AuthService({'firebase_enabled': True})

        result = service.register_user(
            'person@example.com',
            'a valid password',
            {'email_verified': True, 'disabled': True},
        )

        self.assertFalse(result['success'])
        firebase_auth.create_user.assert_not_called()

    @patch('src.auth_service.initialize_firebase_app', return_value=object())
    @patch('src.auth_service.FIREBASE_AVAILABLE', True)
    @patch('src.auth_service.auth')
    def test_registration_rolls_back_account_if_custom_token_creation_fails(
        self, firebase_auth, _initialize
    ):
        firebase_auth.create_user.return_value = SimpleNamespace(
            uid='user-2',
            email='person@example.com',
        )
        firebase_auth.create_custom_token.side_effect = RuntimeError('internal failure')
        service = AuthService({'firebase_enabled': True})

        result = service.register_user('person@example.com', 'a valid password')

        self.assertFalse(result['success'])
        firebase_auth.delete_user.assert_called_once_with('user-2')


class FirebaseInitializationTests(unittest.TestCase):
    @patch('src.firebase_utils.credentials')
    @patch('src.firebase_utils.firebase_admin')
    def test_reuses_an_existing_default_app(self, firebase_admin, _credentials):
        firebase_admin.get_app.return_value = object()

        app = firebase_utils.initialize_firebase_app({})

        self.assertIs(app, firebase_admin.get_app.return_value)
        firebase_admin.initialize_app.assert_not_called()

    @patch('src.firebase_utils.credentials')
    @patch('src.firebase_utils.firebase_admin')
    def test_initializes_default_credentials_with_configured_storage_bucket(
        self, firebase_admin, credentials
    ):
        app = object()
        firebase_admin.get_app.side_effect = [ValueError('not initialized')]
        firebase_admin.initialize_app.return_value = app
        credentials.ApplicationDefault.return_value = object()

        result = firebase_utils.initialize_firebase_app({
            'firebase_storage_bucket': 'private-bucket',
        })

        self.assertIs(result, app)
        firebase_admin.initialize_app.assert_called_once_with(
            credentials.ApplicationDefault.return_value,
            options={'storageBucket': 'private-bucket'},
        )


class FirebaseStorageTests(unittest.TestCase):
    def test_local_storage_rejects_traversal_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            storage_root = os.path.join(directory, 'uploads')
            source = os.path.join(directory, 'source.txt')
            with open(source, 'w', encoding='utf-8') as output:
                output.write('safe')
            service = StorageService({
                'storage_type': 'local',
                'local_storage_dir': storage_root,
            })

            result = service.upload_file(source, '../outside.txt')

            self.assertFalse(result['success'])
            self.assertFalse(os.path.exists(os.path.join(directory, 'outside.txt')))

    @patch('src.storage_service.initialize_firebase_app', return_value=object())
    @patch('src.storage_service.FIREBASE_STORAGE_AVAILABLE', True)
    @patch('src.storage_service.storage')
    def test_firebase_upload_does_not_create_a_public_signed_url(
        self, firebase_storage, _initialize
    ):
        bucket = Mock()
        bucket.name = 'private-bucket'
        blob = Mock()
        blob.bucket = bucket
        firebase_storage.bucket.return_value.blob.return_value = blob

        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, 'video.mp4')
            with open(source, 'wb') as output:
                output.write(b'video')
            service = StorageService({
                'storage_type': 'firebase',
                'firebase_storage_bucket': 'private-bucket',
                'local_storage_dir': os.path.join(directory, 'uploads'),
            })

            result = service.upload_file(source, 'videos/user-1/video.mp4')

        self.assertTrue(result['success'])
        self.assertEqual(result['file_url'], 'gs://private-bucket/videos/user-1/video.mp4')
        self.assertEqual(result['storage_type'], 'firebase')
        blob.generate_signed_url.assert_not_called()
        blob.upload_from_filename.assert_called_once_with(
            source,
            content_type='video/mp4',
        )

    def test_authenticated_video_requires_a_verified_id_token(self):
        system = IntegratedSystem.__new__(IntegratedSystem)
        system.auth_service = Mock()
        system.auth_service.verify_token.return_value = {'success': False}
        system.short_generator = Mock()
        system.storage_service = Mock()

        result = system.generate_authenticated_video('script.md', 'invalid-token')

        self.assertFalse(result['success'])
        self.assertEqual(result['status'], 'unauthorized')
        system.short_generator.generate_full_video.assert_not_called()
        system.storage_service.upload_file.assert_not_called()

    def test_authenticated_video_uses_uid_from_the_verified_token(self):
        system = IntegratedSystem.__new__(IntegratedSystem)
        system.auth_service = Mock()
        system.auth_service.verify_token.return_value = {
            'success': True,
            'user_id': 'verified-user',
        }
        system.short_generator = Mock()
        system.storage_service = Mock()

        with tempfile.TemporaryDirectory() as directory:
            video_path = os.path.join(directory, 'final.mp4')
            with open(video_path, 'wb') as output:
                output.write(b'mp4')
            system.short_generator.generate_full_video.return_value = {
                'success': True,
                'video_file': video_path,
                'audio_file': None,
                'status': 'completed',
            }
            system.storage_service.upload_file.return_value = {
                'success': True,
                'storage_path': 'videos/verified-user/final.mp4',
            }

            result = system.generate_authenticated_video('script.md', 'valid-id-token')

        self.assertTrue(result['success'])
        self.assertEqual(
            system.storage_service.upload_file.call_args.args[1],
            'videos/verified-user/final.mp4',
        )


if __name__ == '__main__':
    unittest.main()
