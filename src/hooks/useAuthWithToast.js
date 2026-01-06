import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Custom hook that combines auth and toast functionality
export const useAuthWithToast = () => {
  const { signup, login, logout, currentUser } = useAuth();
  const { addToast } = useToast();

  const signupWithToast = async (email, password) => {
    try {
      const result = await signup(email, password);
      addToast('Account created successfully!', 'success');
      return result;
    } catch (error) {
      let errorMessage = 'Failed to create account';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use. Please use a different email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please enter a valid email.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const loginWithToast = async (email, password) => {
    try {
      const result = await login(email, password);
      addToast('Logged in successfully!', 'success');
      return result;
    } catch (error) {
      let errorMessage = 'Failed to log in';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please enter a valid email.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password authentication is not enabled.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const logoutWithToast = async () => {
    try {
      await logout();
      addToast('Logged out successfully!', 'info');
      return Promise.resolve();
    } catch (error) {
      addToast('Failed to log out', 'error');
      throw error;
    }
  };

  return {
    signup: signupWithToast,
    login: loginWithToast,
    logout: logoutWithToast,
    currentUser
  };
};