// 認証状態管理コンテキスト
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Firestoreからプロフィール取得
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
        } else {
          // 初回ユーザー: プロフィール未設定
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Googleログイン
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('ログインエラー:', error);
      throw error;
    }
  };

  // ログアウト
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('ログアウトエラー:', error);
      throw error;
    }
  };

  // プロフィール保存（初回セットアップ）
  const saveProfile = async (nickname, avatarColor) => {
    if (!user) return;
    const profileData = {
      uid: user.uid,
      email: user.email,
      nickname,
      avatarColor,
      role: 'member',
      createdAt: new Date(),
    };
    await setDoc(doc(db, 'users', user.uid), profileData);
    setUserProfile(profileData);
  };

  // プロフィール更新
  const updateProfile = async (nickname, avatarColor) => {
    if (!user || !userProfile) return;
    const updated = { ...userProfile, nickname, avatarColor };
    await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
    setUserProfile(updated);
  };

  // アカウント削除（Firestoreのユーザードキュメントを削除してログアウト）
  const deleteAccount = async () => {
    if (!user) return;
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', user.uid));
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const value = {
    user,
    userProfile,
    loading,
    signInWithGoogle,
    signOut,
    saveProfile,
    updateProfile,
    deleteAccount,
    isAdmin: userProfile?.role === 'admin',
    isAuthenticated: !!user,
    needsSetup: !!user && !userProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
