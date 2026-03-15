import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Send } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface FeedbackScreenProps {
  key?: string;
  user: UserProfile;
  onBack: () => void;
}

export default function FeedbackScreen({ user, onBack }: FeedbackScreenProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState(user.name);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (submitted) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userName: name,
        email,
        rating,
        comment,
        timestamp: serverTimestamp()
      });
      setSubmitted(true);
      setComment('');
      setRating(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center p-6 relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[600px] bg-[#151a21] border border-white/5 p-10 rounded-2xl shadow-2xl"
      >
        <h2 className="text-3xl font-bold text-white mb-2">Player Feedback</h2>
        <p className="text-zinc-500 text-sm mb-8">We value your opinion. Let us know how we can improve.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-white">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0f1419] border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rahee/50 transition-colors"
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-white">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0f1419] border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rahee/50 transition-colors"
                placeholder="player@example.com"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-white">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={`feedback-star-${star}`}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star 
                    className={`w-8 h-8 transition-colors ${
                      rating >= star ? 'text-rahee fill-rahee' : 'text-zinc-600'
                    }`} 
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-white">Feedback</label>
            <textarea
              required
              rows={6}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full bg-[#0f1419] border border-white/10 rounded-lg py-4 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rahee/50 transition-colors resize-none"
              placeholder="Tell us what you think..."
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <button 
              type="button"
              onClick={onBack}
              className="bg-[#1d2126] hover:bg-[#252a30] text-white font-bold py-3 px-8 rounded-lg transition-all border border-white/5"
            >
              Back to Menu
            </button>
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="bg-rahee hover:bg-rahee/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-all flex items-center gap-3 shadow-lg shadow-rahee/20"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 right-8 bg-[#151a21] border border-white/5 p-6 rounded-xl shadow-2xl z-50 min-w-[300px]"
          >
            <h4 className="text-white font-bold mb-1">Feedback Sent!</h4>
            <p className="text-zinc-500 text-sm">Thank you for helping us improve Rahee Cards.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
