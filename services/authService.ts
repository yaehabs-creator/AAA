import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  User,
  UserCredential 
} from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface UserProfile {
  email: string;
  role: 'admin' | 'editor' | 'viewer' | 'pending';
  createdAt: Timestamp;
}

export const signUp = async (email: string, password: string): Promise<UserCredential> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Check if this is the first user (admin)
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const isFirstUser = usersSnapshot.empty;

  // Create user document
  const userDoc: Omit<UserProfile, 'createdAt'> & { createdAt: any } = {
    email: user.email || email,
    role: isFirstUser ? 'admin' : 'pending',
  };

  await setDoc(doc(db, 'users', user.uid), {
    ...userDoc,
    createdAt: serverTimestamp(),
  });

  return userCredential;
};

export const login = async (email: string, password: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};

export const getUserRole = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
