/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getDoc, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { handleFirestoreError, OperationType } from './utils/firebaseErrors';
import { UserProfile, GameRoom, Player, CardData } from './types';
import { CARDS } from './constants';
import { 
  Trophy, 
  User, 
  Key, 
  Play, 
  Users, 
  Monitor, 
  MessageSquare, 
  Star, 
  ArrowLeft,
  LogOut,
  LogOut as LogOutIcon, // Added to avoid conflict if needed
  Loader2,
  ShieldAlert
} from 'lucide-react';

// Components
import GameScreen from './components/GameScreen';
import AuthScreen from './components/AuthScreen';
import MainMenu from './components/MainMenu';
import FeedbackScreen from './components/FeedbackScreen';
import SplashScreen from './components/SplashScreen';
import CardManager from './components/CardManager';

export default function App() {
  const [view, setView] = useState<'splash' | 'auth' | 'menu' | 'game' | 'feedback' | 'admin'>('splash');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);

  useEffect(() => {
    // Fetch cards from Firestore
    const unsubscribeCards = onSnapshot(collection(db, 'cards'), (snap) => {
      if (snap.empty) {
        // Initialize cards if empty
        CARDS.forEach(async (card) => {
          await setDoc(doc(db, 'cards', card.id), card);
        });
      } else {
        const fetchedCards = snap.docs.map(doc => doc.data() as CardData);
        setCards(fetchedCards.sort((a, b) => Number(a.id) - Number(b.id)));
      }
    });

    return () => unsubscribeCards();
  }, []);

  useEffect(() => {
    // Initial splash delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Test connection regardless of auth state since we'll allow unauthenticated access
      try {
        await getDocFromServer(doc(db, 'connection_test', 'ping'));
        setIsOffline(false);
      } catch (err: any) {
        if (err.code === 'permission-denied') {
          setIsOffline(false);
        } else if (err.message?.includes('client is offline') || err.code === 'unavailable') {
          setIsOffline(true);
        }
      }

      if (firebaseUser) {
        const savedProfile = localStorage.getItem('rahee_profile');
        if (savedProfile) {
          setUser(JSON.parse(savedProfile));
          setView('menu');
        } else {
          setView('auth');
        }
      } else {
        // Even if not logged into Firebase Auth, we check local storage for Rahee profile
        const savedProfile = localStorage.getItem('rahee_profile');
        if (savedProfile) {
          setUser(JSON.parse(savedProfile));
          setView('menu');
        } else {
          setView('auth');
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const handleLogin = async (name: string, key: string) => {
    setError(null);
    setLoading(true);
    const path = `users/${key}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', key));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        if (userData.name === name) {
          setUser(userData);
          localStorage.setItem('rahee_profile', JSON.stringify(userData));
          
          await addDoc(collection(db, 'auth_logs'), {
            type: 'login',
            status: 'success',
            name,
            raheeKey: key,
            timestamp: serverTimestamp()
          });
          
          setView('menu');
        } else {
          setError('Wrong Key');
        }
      } else {
        setError('Unregistered User');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      setError('Connection Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (name: string, key: string) => {
    setError(null);
    setLoading(true);
    const path = `users/${key}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', key));
      if (userDoc.exists()) {
        setError('Key already taken');
        return;
      }
      const newProfile: UserProfile = {
        name,
        raheeKey: key,
        wins: 0,
        losses: 0
      };
      await setDoc(doc(db, 'users', key), {
        ...newProfile,
        createdAt: serverTimestamp()
      });
      setUser(newProfile);
      localStorage.setItem('rahee_profile', JSON.stringify(newProfile));
      
      await addDoc(collection(db, 'auth_logs'), {
        type: 'signup',
        status: 'success',
        name,
        raheeKey: key,
        timestamp: serverTimestamp()
      });
      
      setView('menu');
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      setError('Signup Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    localStorage.removeItem('rahee_profile');
    setView('auth');
  };

  const generateRoomKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const createRoom = async () => {
    if (!user || cards.length === 0) return;
    setLoading(true);
    const roomKey = generateRoomKey();
    const myUid = auth.currentUser?.uid || user.raheeKey;
    const allCards = [...cards].sort(() => Math.random() - 0.5);
    const half = Math.ceil(allCards.length / 2);
    const myDeck = allCards.slice(0, half);
    const opponentDeck = allCards.slice(half);

    const newRoomData = {
      roomKey,
      hostUid: myUid,
      status: 'waiting',
      players: [{
        uid: myUid,
        name: user.name,
        deck: myDeck,
        ready: true
      }],
      currentTurn: '',
      createdAt: serverTimestamp()
    };

    try {
      const newRoomRef = await addDoc(collection(db, 'rooms'), newRoomData);
      setRoom({ ...newRoomData, id: newRoomRef.id, createdAt: new Date() } as any);
      setView('game');
    } catch (err) {
      console.error(err);
      setError('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const joinRoomWithKey = async (key: string) => {
    if (!user || !key) return;
    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'rooms'),
        where('roomKey', '==', key),
        where('status', '==', 'waiting')
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('Invalid or expired room key');
        setLoading(false);
        return;
      }

      const roomDoc = snap.docs[0];
      const roomData = roomDoc.data() as GameRoom;

      // Check if player already in room
      const isAlreadyIn = roomData.players.some(p => p.uid === (auth.currentUser?.uid || user.raheeKey));
      if (isAlreadyIn) {
        setRoom({ ...roomData, id: roomDoc.id });
        setView('game');
        setLoading(false);
        return;
      }

      const updatedPlayers = [...roomData.players, {
        uid: auth.currentUser?.uid || user.raheeKey,
        name: user.name,
        deck: cards.filter(c => !roomData.players[0].deck.some(pc => pc.id === c.id)),
        ready: true
      }];

      await updateDoc(doc(db, 'rooms', roomDoc.id), {
        players: updatedPlayers
      });

      setRoom({ ...roomData, players: updatedPlayers, id: roomDoc.id });
      setView('game');
    } catch (err) {
      console.error(err);
      setError('Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (mode: 'solo' | '1v1') => {
    if (!user) return;
    setLoading(true);

    if (mode === 'solo') {
      const allCards = [...cards].sort(() => Math.random() - 0.5);
      const half = Math.ceil(allCards.length / 2);
      
      const humanPlayer: Player = {
        uid: auth.currentUser?.uid || user.raheeKey,
        name: user.name,
        deck: allCards.slice(0, half),
        ready: true
      };
      const aiPlayer: Player = {
        uid: 'ai_bot',
        name: 'Rahee AI',
        deck: allCards.slice(half),
        ready: true
      };
      const newRoom: GameRoom = {
        id: 'solo_' + Date.now(),
        roomKey: 'SOLO',
        hostUid: auth.currentUser?.uid || user.raheeKey,
        status: 'playing',
        players: [humanPlayer, aiPlayer],
        currentTurn: humanPlayer.uid,
        createdAt: new Date()
      };
      setRoom(newRoom);
      setView('game');
      setLoading(false);
      return;
    }

    try {
      const roomsQuery = query(
        collection(db, 'rooms'),
        where('status', '==', 'waiting')
      );
      const roomsSnap = await getDocs(roomsQuery);
      
      if (!roomsSnap.empty) {
        const roomDoc = roomsSnap.docs[0];
        const roomData = roomDoc.data() as GameRoom;
        const myUid = auth.currentUser?.uid || user.raheeKey;
        const updatedPlayers = [...roomData.players, {
          uid: myUid,
          name: user.name,
          deck: cards.filter(c => !roomData.players[0].deck.some(pc => pc.id === c.id)),
          ready: true
        }];
        
        await updateDoc(doc(db, 'rooms', roomDoc.id), {
          players: updatedPlayers
        });
        
        setRoom({ ...roomData, players: updatedPlayers, id: roomDoc.id });
        setView('game');
        setLoading(false);
      } else {
        const myUid = auth.currentUser?.uid || user.raheeKey;
        const allCards = [...cards].sort(() => Math.random() - 0.5);
        const half = Math.ceil(allCards.length / 2);
        
        const newRoomData = {
          status: 'waiting',
          hostUid: myUid,
          players: [{
            uid: myUid,
            name: user.name,
            deck: allCards.slice(0, half),
            ready: true
          }],
          currentTurn: '',
          createdAt: serverTimestamp()
        };
        
        const newRoomRef = await addDoc(collection(db, 'rooms'), newRoomData);
        
        // Set initial room state for the creator
        setRoom({ ...newRoomData, id: newRoomRef.id, createdAt: new Date() } as any);
        setView('game');
        setLoading(false);

        onSnapshot(doc(db, 'rooms', newRoomRef.id), (doc) => {
          if (doc.exists()) {
            const data = doc.data() as GameRoom;
            setRoom({ ...data, id: doc.id });
          }
        });
      }
    } catch (err) {
      console.error(err);
      setError('Matchmaking failed');
      setLoading(false);
    }
  };

  if (view === 'splash') return <SplashScreen onComplete={() => setView('auth')} />;

  const isAdmin = user?.name?.toLowerCase() === 'rahee';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-rahee/30">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 backdrop-blur-md px-4 py-2 flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>Connection Error: Please ensure Firestore is enabled in your Firebase Console and rules allow access.</span>
          </div>
          <a 
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white/80 transition-colors"
          >
            Open Console
          </a>
        </div>
      )}
      <AnimatePresence mode="wait">
        {view === 'auth' && (
          <AuthScreen 
            key="auth-screen"
            onLogin={handleLogin} 
            onSignup={handleSignup} 
            error={error} 
            loading={loading}
          />
        )}
        {view === 'menu' && user && (
          <MainMenu 
            key="menu-screen"
            user={user} 
            onJoinRoom={joinRoom} 
            onCreateRoom={createRoom}
            onJoinWithKey={joinRoomWithKey}
            onLogout={handleLogout}
            onFeedback={() => setView('feedback')}
            isAdmin={isAdmin}
            onAdminClick={() => setView('admin')}
          />
        )}
        {view === 'admin' && user && isAdmin && (
          <CardManager 
            onBack={() => setView('menu')}
            cards={cards}
          />
        )}
        {view === 'game' && room && user && (
          <GameScreen 
            key="game-screen"
            room={room} 
            user={user} 
            onExit={() => { setRoom(null); setView('menu'); }} 
            isAdmin={isAdmin}
          />
        )}
        {view === 'feedback' && user && (
          <FeedbackScreen 
            key="feedback-screen"
            user={user} 
            onBack={() => setView('menu')} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
