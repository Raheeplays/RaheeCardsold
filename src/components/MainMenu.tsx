import React from 'react';
import { motion } from 'motion/react';
import { User, Users, Monitor, Star, LogOut } from 'lucide-react';
import { UserProfile } from '../types';

interface MainMenuProps {
  key?: string;
  user: UserProfile;
  onJoinRoom: (mode: 'solo' | '1v1') => void;
  onCreateRoom: () => void;
  onJoinWithKey: (key: string) => void;
  onLogout: () => void;
  onFeedback: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
}

export default function MainMenu({ 
  user, 
  onJoinRoom, 
  onCreateRoom, 
  onJoinWithKey, 
  onLogout, 
  onFeedback,
  isAdmin,
  onAdminClick
}: MainMenuProps) {
  const [menuState, setMenuState] = React.useState<'initial' | 'multiplayer' | 'join'>('initial');
  const [joinKey, setJoinKey] = React.useState('');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#0f1419] flex flex-col relative font-sans"
    >
      {/* Top Right Header */}
      <div className="absolute top-8 right-10 flex items-center gap-4 text-zinc-400">
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest leading-none mb-1">Welcome</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white italic">{user.name}</span>
            {isAdmin && (
              <span className="text-[9px] bg-rahee/20 text-rahee px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                Admin
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-zinc-400 hover:text-white"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Central Menu Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-[440px] bg-[#151a21] border border-white/5 p-12 rounded-2xl shadow-2xl flex flex-col items-center"
        >
          <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Main Menu
          </h2>
          <p className="text-zinc-500 text-sm mb-10">
            {menuState === 'initial' ? 'Choose your game mode' : menuState === 'multiplayer' ? 'Multiplayer Mode' : 'Join a Room'}
          </p>

          <div className="w-full space-y-0.5">
            {menuState === 'initial' && (
              <>
                <button 
                  onClick={() => onJoinRoom('solo')}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 rounded-t-xl transition-all flex items-center justify-center gap-3"
                >
                  <Monitor className="w-5 h-5" />
                  Solo vs. AI
                </button>
                <button 
                  onClick={() => onJoinRoom('1v1')}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 transition-all flex items-center justify-center gap-3"
                >
                  <User className="w-5 h-5" />
                  Dual Player 1v1
                </button>
                <button 
                  onClick={() => setMenuState('multiplayer')}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 rounded-b-xl transition-all flex items-center justify-center gap-3"
                >
                  <Users className="w-5 h-5" />
                  Multiplayer
                </button>
                {isAdmin && (
                  <button 
                    onClick={onAdminClick}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 mt-4 shadow-lg shadow-amber-500/20"
                  >
                    <Star className="w-5 h-5 fill-current" />
                    Rahee Cards
                  </button>
                )}
              </>
            )}

            {menuState === 'multiplayer' && (
              <div className="space-y-3">
                <button 
                  onClick={onCreateRoom}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <Users className="w-5 h-5" />
                  Create Room
                </button>

                <button 
                  onClick={() => setMenuState('join')}
                  className="w-full bg-[#1d2126] hover:bg-[#252a30] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                >
                  <Users className="w-5 h-5" />
                  Join Room
                </button>

                <button 
                  onClick={() => setMenuState('initial')}
                  className="w-full text-zinc-500 hover:text-white text-sm font-medium py-2 transition-colors"
                >
                  Back to Main
                </button>
              </div>
            )}

            {menuState === 'join' && (
              <div className="space-y-3">
                <div className="space-y-4">
                  <input 
                    type="text"
                    placeholder="Enter Room Key"
                    value={joinKey}
                    onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-4 px-4 text-center text-2xl font-mono tracking-widest focus:border-rahee outline-none transition-all"
                    maxLength={6}
                  />
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setMenuState('multiplayer'); setJoinKey(''); }}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => onJoinWithKey(joinKey)}
                      className="flex-[2] bg-rahee hover:bg-rahee/90 text-white font-bold py-4 rounded-lg transition-all"
                    >
                      Join Room
                    </button>
                  </div>
                </div>
              </div>
            )}

            {menuState === 'initial' && (
              <div className="pt-6">
                <button 
                  onClick={onFeedback}
                  className="w-full bg-[#1d2126] hover:bg-[#252a30] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                >
                  <Star className="w-5 h-5" />
                  Feedback
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
