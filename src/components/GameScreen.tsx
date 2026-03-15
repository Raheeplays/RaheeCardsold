import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GameRoom, UserProfile, CardData } from '../types';
import { STAT_LABELS, CARDS } from '../constants';
import { ArrowLeft, Trophy, ShieldAlert, Loader2, User as UserIcon, Users, Play } from 'lucide-react';
import Card from './Card';

interface GameScreenProps {
  key?: string;
  room: GameRoom;
  user: UserProfile;
  onExit: () => void;
  isAdmin?: boolean;
}

export default function GameScreen({ room: initialRoom, user, onExit, isAdmin }: GameScreenProps) {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isAdminVisionEnabled, setIsAdminVisionEnabled] = useState(isAdmin);
  const [isAiGodMode, setIsAiGodMode] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [transferringCard, setTransferringCard] = useState<{ card: CardData; from: 'me' | 'opponent'; to: 'me' | 'opponent' } | null>(null);
  const [selectedStat, setSelectedStat] = useState<keyof CardData['stats'] | null>(null);

  // Robust player identification
  const myUid = auth.currentUser?.uid || user.raheeKey;
  const me = room.players.find(p => p.uid === myUid);
  
  // For multiplayer, opponents are everyone else
  const opponents = room.players.filter(p => p.uid !== myUid);
  // For 1v1 logic, we still use 'opponent' as the first one found
  const opponent = opponents[0];
  
  const isHost = room.hostUid === myUid;

  const startGame = async () => {
    if ((!isHost && !isAdmin) || room.players.length < 2) return;
    
    await updateDoc(doc(db, 'rooms', room.id), {
      status: 'playing',
      currentTurn: room.players[0].uid
    });
  };

  if (!me) {
    // Fallback: try to find by name if UID fails (less secure but helps with "Player Not Found")
    const meByName = room.players.find(p => p.name === user.name);
    if (meByName) {
      // If found by name, we can proceed but we should probably update their UID in the DB
      // for future consistency, but for now let's just use it.
    } else {
      console.log('Player Identification Debug:', {
        myUid,
        userName: user.name,
        roomPlayers: room.players.map(p => ({ uid: p.uid, name: p.name })),
        authUid: auth.currentUser?.uid,
        raheeKey: user.raheeKey
      });
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
          <div className="text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Player Not Found</h2>
            <p className="text-zinc-500 mb-6">We couldn't find your profile in this room. Please try re-joining.</p>
            <button onClick={onExit} className="bg-white text-black px-6 py-2 rounded-lg font-bold">
              Back to Menu
            </button>
          </div>
        </div>
      );
    }
  }

  // Use the found player (either by UID or name fallback)
  const activeMe = me || room.players.find(p => p.name === user.name)!;

  const isMyTurn = room.currentTurn === activeMe.uid || (room.id.startsWith('solo_') && room.currentTurn === 'human');

  useEffect(() => {
    if (room.id.startsWith('solo_')) return;

    const unsubscribe = onSnapshot(doc(db, 'rooms', room.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as GameRoom;
        setRoom({ ...data, id: doc.id });
        
        // Sync comparison state from Firestore
        if (data.comparison) {
          if (data.comparison.playerUid !== activeMe.uid) {
            setIsComparing(true);
            // Determine result for the non-initiator
            const myCard = activeMe.deck[0];
            const initiator = data.players.find(p => p.uid === data.comparison?.playerUid);
            const initiatorCard = initiator?.deck[0];
            
            if (myCard && initiatorCard) {
              const stat = data.comparison.stat;
              if (myCard.stats[stat] > initiatorCard.stats[stat]) setResult('win');
              else if (myCard.stats[stat] < initiatorCard.stats[stat]) setResult('lose');
              else setResult('draw');
              setShowResult(true);
            }
          }
        } else {
          // No comparison active in Firestore
          setIsComparing(false);
          setShowResult(false);
          setResult(null);
        }
      }
    });
    return () => unsubscribe();
  }, [room.id, activeMe.uid]);

  const handleStatSelect = async (stat: keyof CardData['stats']) => {
    if (!isMyTurn || isComparing) return;

    // God Mode: If enabled, pick the best card from Rahee's deck before comparing
    if (isAdmin && isAiGodMode) {
      optimizeRaheeDeck(stat);
    }

    setIsComparing(true);
    const myCard = activeMe.deck[0];
    const opponentCard = opponent?.deck[0];

    if (!myCard || !opponentCard) {
      setIsComparing(false);
      return;
    }

    const myValue = myCard.stats[stat];
    const opponentValue = opponentCard.stats[stat];
    setSelectedStat(stat);

    let roundResult: 'win' | 'lose' | 'draw' = 'draw';
    if (myValue > opponentValue) roundResult = 'win';
    else if (myValue < opponentValue) roundResult = 'lose';

    setResult(roundResult);
    setShowResult(true);

    // Set transferring card for animation
    if (roundResult === 'win') {
      setTransferringCard({ card: opponent!.deck[0], from: 'opponent', to: 'me' });
    } else if (roundResult === 'lose') {
      setTransferringCard({ card: activeMe.deck[0], from: 'me', to: 'opponent' });
    }

    // Update room immediately to sync comparison state
    if (!room.id.startsWith('solo_')) {
      await updateDoc(doc(db, 'rooms', room.id), {
        comparison: {
          stat,
          playerUid: activeMe.uid,
          startTime: new Date().toISOString()
        }
      });
    }

    // Delay for animation
    setTimeout(async () => {
      setTransferringCard(null);
      setSelectedStat(null);
      const newMeDeck = [...activeMe.deck];
      const newOpponentDeck = [...opponent!.deck];

      if (roundResult === 'win') {
        const wonCard = newOpponentDeck.shift()!;
        newMeDeck.push(newMeDeck.shift()!);
        newMeDeck.push(wonCard);
      } else if (roundResult === 'lose') {
        const lostCard = newMeDeck.shift()!;
        newOpponentDeck.push(newOpponentDeck.shift()!);
        newOpponentDeck.push(lostCard);
      } else {
        newMeDeck.push(newMeDeck.shift()!);
        newOpponentDeck.push(newOpponentDeck.shift()!);
      }

      const nextTurn = roundResult === 'win' ? activeMe.uid : (roundResult === 'lose' ? opponent.uid : room.currentTurn);
      
      let gameStatus = room.status;
      let winner = room.winner || '';

      if (newMeDeck.length === 0) {
        gameStatus = 'finished';
        winner = opponent.uid;
        updateStats(false);
      } else if (newOpponentDeck.length === 0) {
        gameStatus = 'finished';
        winner = activeMe.uid;
        updateStats(true);
      }

      const updatedPlayers = room.players.map(p => {
        if (p.uid === activeMe.uid) return { ...p, deck: newMeDeck };
        if (p.uid === opponent.uid) return { ...p, deck: newOpponentDeck };
        return p;
      });

      const updateData: any = {
        players: updatedPlayers,
        currentTurn: nextTurn,
        status: gameStatus,
        winner: winner,
        comparison: null, // Clear comparison
        lastAction: {
          playerUid: activeMe.uid,
          stat,
          value: myValue,
          result: roundResult
        }
      };

      if (room.id.startsWith('solo_')) {
        setRoom(prev => ({ ...prev, ...updateData }));
        // AI Turn
        if (nextTurn === 'ai_bot' && gameStatus === 'playing') {
          setTimeout(() => handleAiTurn(updatedPlayers), 2000);
        }
      } else {
        await updateDoc(doc(db, 'rooms', room.id), updateData);
      }

      setIsComparing(false);
      setShowResult(false);
    }, 3000);
  };

  const handleAiTurn = (players: any[]) => {
    const ai = players.find(p => p.uid === 'ai_bot');
    const human = players.find(p => p.uid !== 'ai_bot');
    
    if (!ai || !human || !ai.deck[0] || !human.deck[0]) return;

    const aiCard = ai.deck[0];
    
    // Simple AI: pick highest stat (excluding 'no')
    const stats = (Object.keys(aiCard.stats) as Array<keyof CardData['stats']>).filter(s => s !== 'no');
    const bestStat = stats.reduce((prev, curr) => aiCard.stats[curr] > aiCard.stats[prev] ? curr : prev);
    
    // Simulate AI selection
    setIsComparing(true);
    setSelectedStat(bestStat);
    const aiValue = aiCard.stats[bestStat];
    const humanValue = human.deck[0].stats[bestStat];

    let roundResult: 'win' | 'lose' | 'draw' = 'draw';
    if (aiValue > humanValue) roundResult = 'win'; // AI wins round
    else if (aiValue < humanValue) roundResult = 'lose'; // AI loses round

    setResult(roundResult === 'win' ? 'lose' : (roundResult === 'lose' ? 'win' : 'draw'));
    setShowResult(true);

    // Set transferring card for animation
    if (roundResult === 'win') {
      setTransferringCard({ card: human.deck[0], from: 'me', to: 'opponent' });
    } else if (roundResult === 'lose') {
      setTransferringCard({ card: ai.deck[0], from: 'opponent', to: 'me' });
    }

    setTimeout(() => {
      setTransferringCard(null);
      setSelectedStat(null);
      const newAiDeck = [...ai.deck];
      const newHumanDeck = [...human.deck];

      if (roundResult === 'win') {
        const wonCard = newHumanDeck.shift()!;
        newAiDeck.push(newAiDeck.shift()!);
        newAiDeck.push(wonCard);
      } else if (roundResult === 'lose') {
        const lostCard = newAiDeck.shift()!;
        newHumanDeck.push(newHumanDeck.shift()!);
        newHumanDeck.push(lostCard);
      } else {
        newAiDeck.push(newAiDeck.shift()!);
        newHumanDeck.push(newHumanDeck.shift()!);
      }

      const nextTurn = roundResult === 'win' ? 'ai_bot' : (roundResult === 'lose' ? human.uid : 'ai_bot');
      
      let gameStatus = 'playing';
      let winner = '';

      if (newHumanDeck.length === 0) {
        gameStatus = 'finished';
        winner = 'ai_bot';
        updateStats(false);
      } else if (newAiDeck.length === 0) {
        gameStatus = 'finished';
        winner = human.uid;
        updateStats(true);
      }

      const updatedPlayers = [
        { ...human, deck: newHumanDeck },
        { ...ai, deck: newAiDeck }
      ];

      setRoom(prev => ({
        ...prev,
        players: updatedPlayers,
        currentTurn: nextTurn,
        status: gameStatus as any,
        winner,
        lastAction: {
          playerUid: 'ai_bot',
          stat: bestStat,
          value: aiValue,
          result: roundResult
        }
      }));

      setIsComparing(false);
      setShowResult(false);

      if (nextTurn === 'ai_bot' && gameStatus === 'playing') {
        setTimeout(() => handleAiTurn(updatedPlayers), 2000);
      }
    }, 3000);
  };

  const updateStats = async (won: boolean) => {
    try {
      await updateDoc(doc(db, 'users', user.raheeKey), {
        wins: increment(won ? 1 : 0),
        losses: increment(won ? 0 : 1)
      });
      // Update local storage too
      const profile = JSON.parse(localStorage.getItem('rahee_profile') || '{}');
      profile.wins += won ? 1 : 0;
      profile.losses += won ? 0 : 1;
      localStorage.setItem('rahee_profile', JSON.stringify(profile));
    } catch (err) {
      console.error('Failed to update stats', err);
    }
  };

  const optimizeRaheeDeck = async (stat: keyof CardData['stats']) => {
    if (!isAdmin || !opponent) return;
    
    const opponentCard = opponent.deck[0];
    if (!opponentCard) return;

    const myDeck = [...activeMe.deck];
    // Find a card that beats the opponent's stat
    const winningCardIndex = myDeck.findIndex(c => c.stats[stat] > opponentCard.stats[stat]);
    
    if (winningCardIndex !== -1) {
      const [bestCard] = myDeck.splice(winningCardIndex, 1);
      myDeck.unshift(bestCard);
      
      const updatedPlayers = room.players.map(p => {
        if (p.uid === activeMe.uid) return { ...p, deck: myDeck };
        return p;
      });

      if (room.id.startsWith('solo_')) {
        setRoom(prev => ({ ...prev, players: updatedPlayers }));
      } else {
        await updateDoc(doc(db, 'rooms', room.id), { players: updatedPlayers });
      }
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!isAdmin || isComparing) return;

    const newDeck = [...activeMe.deck];
    if (direction === 'right') {
      newDeck.push(newDeck.shift()!);
    } else {
      newDeck.unshift(newDeck.pop()!);
    }

    const updatedPlayers = room.players.map(p => {
      if (p.uid === activeMe.uid) return { ...p, deck: newDeck };
      return p;
    });

    if (room.id.startsWith('solo_')) {
      setRoom(prev => ({ ...prev, players: updatedPlayers }));
    } else {
      await updateDoc(doc(db, 'rooms', room.id), { players: updatedPlayers });
    }
  };

  const reorderOpponentDeck = async (fromIndex: number, toIndex: number) => {
    if (!isAdmin || !opponent || room.id.startsWith('solo_')) return;
    
    const newDeck = [...opponent.deck];
    const [moved] = newDeck.splice(fromIndex, 1);
    newDeck.splice(toIndex, 0, moved);

    const updatedPlayers = room.players.map(p => {
      if (p.uid === opponent.uid) return { ...p, deck: newDeck };
      return p;
    });

    await updateDoc(doc(db, 'rooms', room.id), {
      players: updatedPlayers
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-black overflow-hidden relative">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-zinc-900/50 border-b border-white/5 z-10">
        <button onClick={onExit} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Turn</p>
            <p className={`text-sm font-bold ${isMyTurn ? 'text-rahee' : 'text-zinc-400'}`}>
              {isMyTurn ? 'Your Turn' : `${opponent?.name || 'Opponent'}'s Turn`}
            </p>
          </div>
          <div className="w-10 h-10 bg-rahee rounded-lg flex items-center justify-center text-white font-bold">
            {isMyTurn ? '!' : '?'}
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-around p-6 gap-8 relative">
        {/* My Area */}
        <div className="w-full max-w-[280px] flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-rahee">
            <UserIcon className="w-4 h-4" />
            <span className="text-sm font-bold">{activeMe.name} (You)</span>
            <span className="text-xs bg-rahee/10 px-2 py-0.5 rounded-full">{activeMe.deck.length} Cards</span>
          </div>
          <div className="relative w-full">
            {/* Decorative stack layers to simulate a deck */}
            {activeMe.deck.length > 1 && (
              <div className="absolute inset-0 translate-y-1 translate-x-1 bg-zinc-800 rounded-2xl border border-white/5 opacity-50" style={{ zIndex: 1 }} />
            )}
            {activeMe.deck.length > 2 && (
              <div className="absolute inset-0 translate-y-2 translate-x-2 bg-zinc-900 rounded-2xl border border-white/5 opacity-30" style={{ zIndex: 0 }} />
            )}
            
            {activeMe.deck.length > 0 && (
              <div className="relative z-10">
                <Card 
                  card={activeMe.deck[0]} 
                  isTop={true}
                  disabled={!isMyTurn || isComparing}
                  isSelected={selectedStat !== null}
                  isAdmin={isAdmin}
                  onStatSelect={handleStatSelect}
                  onNotchClick={isAdmin ? () => setIsAdminVisionEnabled(!isAdminVisionEnabled) : undefined}
                  onNotchLongPress={isAdmin ? () => setShowAdminMenu(true) : undefined}
                  onSwipe={isAdmin ? handleSwipe : undefined}
                />
              </div>
            )}
            
            {activeMe.deck.length === 0 && (
              <div className="w-full aspect-[5.7/8.9] bg-zinc-900/50 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No Cards Left</p>
              </div>
            )}
          </div>
        </div>

        {/* Center Info */}
        <AnimatePresence>
          {showResult && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            >
              <div className={`px-12 py-6 rounded-full text-4xl font-black uppercase tracking-tighter shadow-2xl backdrop-blur-md border-4
                ${result === 'win' ? 'bg-rahee/20 border-rahee text-rahee' : 
                  result === 'lose' ? 'bg-red-500/20 border-red-500 text-red-400' : 
                  'bg-zinc-500/20 border-zinc-500 text-zinc-400'}
              `}>
                {result === 'win' ? 'Round Win!' : result === 'lose' ? 'Round Lose' : 'Draw'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opponent Area */}
        <div className="w-full max-w-[280px] flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <UserIcon className="w-4 h-4" />
            <span className="text-sm font-bold">{opponent?.name || 'Waiting...'}</span>
            {opponent && <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">{opponent.deck.length} Cards</span>}
          </div>
          <div className="relative w-full min-h-[300px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {(isAdmin || isComparing) ? (
                <motion.div 
                  key="opponent-stack"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0"
                >
                  {/* Decorative stack layers for opponent */}
                  {(opponent?.deck.length || 0) > 1 && (
                    <div className="absolute inset-0 translate-y-1 translate-x-1 bg-zinc-800 rounded-2xl border border-white/5 opacity-50" style={{ zIndex: 1 }} />
                  )}
                  {(opponent?.deck.length || 0) > 2 && (
                    <div className="absolute inset-0 translate-y-2 translate-x-2 bg-zinc-900 rounded-2xl border border-white/5 opacity-30" style={{ zIndex: 0 }} />
                  )}

                  {opponent?.deck.length && (
                    <div className="relative z-10">
                      <Card 
                        card={opponent.deck[0]} 
                        isOpponent 
                        isRevealed={(isAdmin && isAdminVisionEnabled) || isComparing} 
                        isTop={true}
                        isSelected={selectedStat !== null}
                        isAdmin={isAdmin}
                      />
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {/* Empty space when hidden as requested */}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Transferring Card Animation */}
      <AnimatePresence>
        {transferringCard && (
          <motion.div
            key="transferring-card"
            initial={{ 
              x: transferringCard.from === 'me' ? -200 : 200, 
              y: 0, 
              scale: 1, 
              opacity: 1,
              zIndex: 200
            }}
            animate={{ 
              x: [
                transferringCard.from === 'me' ? -200 : 200, // Start
                transferringCard.to === 'me' ? -200 : 200,   // Move to winner (on top)
                transferringCard.to === 'me' ? -200 : 200    // Stay for a bit then "go under"
              ],
              y: [0, 0, 150], // Move down at the end
              scale: [1, 1.1, 0.8], // Pop up then shrink
              opacity: [1, 1, 0] // Fade out at the end
            }}
            transition={{ duration: 2, times: [0, 0.6, 1], ease: "easeInOut" }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-[280px]">
              <Card card={transferringCard.card} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {room.status === 'finished' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 p-12 rounded-[3rem] text-center shadow-2xl"
            >
              <div className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-8
                ${room.winner === activeMe.uid ? 'bg-rahee text-white' : 'bg-red-500/20 text-red-500'}
              `}>
                <Trophy className="w-12 h-12" />
              </div>
              <h2 className="text-4xl font-black mb-4 uppercase tracking-tight">
                {room.winner === activeMe.uid ? 'Victory!' : 'Defeat'}
              </h2>
              <p className="text-zinc-500 mb-12">
                {room.winner === activeMe.uid 
                  ? 'You have conquered the Rahee realm!' 
                  : 'Better luck next time, warrior.'}
              </p>
              <button 
                onClick={onExit}
                className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-colors"
              >
                Back to Menu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Menu Modal */}
      <AnimatePresence>
        {showAdminMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xs bg-zinc-900 border border-rahee/30 rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(255,99,33,0.2)]"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-rahee/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8 text-rahee" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Rahee Admin</h2>
                <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest mt-1">Control Panel</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setIsAdminVisionEnabled(!isAdminVisionEnabled)}
                  className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-tighter flex items-center justify-between transition-all
                    ${isAdminVisionEnabled ? 'bg-rahee text-white' : 'bg-white/5 text-zinc-400'}
                  `}
                >
                  <span>Admin Vision</span>
                  <div className={`w-2 h-2 rounded-full ${isAdminVisionEnabled ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
                </button>

                <button 
                  onClick={() => setIsAiGodMode(!isAiGodMode)}
                  className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-tighter flex items-center justify-between transition-all
                    ${isAiGodMode ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-zinc-400'}
                  `}
                >
                  <span>AI God Mode</span>
                  <div className={`w-2 h-2 rounded-full ${isAiGodMode ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
                </button>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Quick Tips</p>
                  <ul className="text-[10px] text-zinc-400 space-y-1 font-medium">
                    <li>• Swipe card left/right to change</li>
                    <li>• God Mode picks winning card automatically</li>
                    <li>• Click notch to toggle vision quickly</li>
                  </ul>
                </div>

                <button 
                  onClick={() => setShowAdminMenu(false)}
                  className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
                >
                  Close Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby / Waiting for Opponent */}
      {room.status === 'waiting' && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-40 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#151a21] border border-white/5 rounded-3xl p-8 shadow-2xl"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rahee/10 rounded-2xl mb-4">
                <Users className="w-8 h-8 text-rahee" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Game Lobby</h3>
              <p className="text-zinc-500 text-sm">Waiting for other players to join...</p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mb-8 text-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                {isHost ? 'Room Key' : 'Waiting for Host'}
              </span>
              <div className="text-4xl font-mono font-black text-rahee tracking-[0.2em]">
                {isHost ? room.roomKey : '••••••'}
              </div>
              {!isHost && (
                <p className="text-[10px] text-zinc-600 mt-2 italic">
                  Only the host can see the room key
                </p>
              )}
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">
                <span>Players ({room.players.length})</span>
                <span>Status</span>
              </div>
              <div className="space-y-2">
                {room.players.map((player, idx) => (
                  <div key={player.uid} className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-rahee/20 rounded-lg flex items-center justify-center text-rahee font-bold text-xs">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-white">
                        {player.name} {player.uid === room.hostUid && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded ml-1 uppercase">Host</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Ready
                    </div>
                  </div>
                ))}
                {room.players.length < 2 && (
                  <div className="flex items-center justify-center py-8 border-2 border-dashed border-white/5 rounded-xl text-zinc-600 text-sm italic">
                    Waiting for more players...
                  </div>
                )}
              </div>
            </div>

            { (isHost || isAdmin) ? (
              <button 
                onClick={startGame}
                disabled={room.players.length < 2}
                className="w-full bg-rahee disabled:bg-zinc-800 disabled:text-zinc-500 hover:bg-rahee/90 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-rahee/10 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                {room.players.length < 2 ? 'Waiting for Players...' : 'Start Game'}
              </button>
            ) : (
              <div className="text-center py-4 bg-zinc-900/50 rounded-xl border border-white/5">
                <Loader2 className="w-5 h-5 text-rahee animate-spin mx-auto mb-2" />
                <p className="text-sm text-zinc-400">Waiting for host to start...</p>
              </div>
            )}

            <button 
              onClick={onExit}
              className="w-full mt-4 text-zinc-500 hover:text-white text-sm font-medium transition-colors"
            >
              Leave Room
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
