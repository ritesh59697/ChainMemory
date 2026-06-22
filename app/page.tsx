'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Database, 
  Cpu, 
  Terminal, 
  ArrowRight, 
  Copy, 
  Check, 
  Shield, 
  Activity, 
  RefreshCw, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Info, 
  Play, 
  FileJson,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'saving' | 'saved' | 'failed';
  rootHash?: string;
  txHash?: string;
}

interface IndexItem {
  sessionId: string;
  rootHash: string;
  timestamp: string;
  preview: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyList, setHistoryList] = useState<IndexItem[]>([]);
  const [config, setConfig] = useState({ contractAddress: '', evmRpc: '', indexerRpc: '' });
  
  // Theme state
  const [isDark, setIsDark] = useState(true);

  // Redesign states
  const [showTimeline, setShowTimeline] = useState(true);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Detail inspection state
  const [fetchedMemory, setFetchedMemory] = useState<any | null>(null);
  const [fetchingMemoryHash, setFetchingMemoryHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatConsoleRef = useRef<HTMLDivElement>(null);
  
  // Sequential Upload Queue to avoid nonce collisions
  const uploadQueueRef = useRef<{ id: string; role: 'user' | 'assistant'; content: string }[]>([]);
  const isProcessingQueueRef = useRef(false);

  const enqueueUpload = (id: string, role: 'user' | 'assistant', content: string) => {
    uploadQueueRef.current.push({ id, role, content });
    processQueue();
  };

  const processQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (uploadQueueRef.current.length > 0) {
      const task = uploadQueueRef.current[0];
      await saveMessageTo0G(task.id, task.role, task.content);
      uploadQueueRef.current.shift();
    }

    isProcessingQueueRef.current = false;
  };

  // Toggle theme class on document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [isDark]);

  // Initialize Session, Load Config, and Fetch Timeline
  useEffect(() => {
    const randomHex = Math.random().toString(36).substring(2, 10);
    const generatedSessionId = `session_${randomHex}_${Date.now()}`;
    setSessionId(generatedSessionId);

    // Fetch public configurations
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('[ChainMemory] Failed to load config:', err));

    fetchTimeline();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const fetchTimeline = async () => {
    try {
      const res = await fetch('/api/memory/index');
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        data.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistoryList(data);
      }
    } catch (err) {
      console.error('[ChainMemory] Error fetching timeline index:', err);
    }
  };

  // Helper to copy text to clipboard with feedback
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCopyHash = (e: React.MouseEvent, hash: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Fetch memory details from 0G Storage using /api/memory/fetch
  const handleInspectMemory = async (item: IndexItem) => {
    setFetchingMemoryHash(item.rootHash);
    setFetchError(null);
    setFetchedMemory(null);
    setShowDetailModal(true);

    try {
      const res = await fetch('/api/memory/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootHash: item.rootHash }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to download memory');
      }

      const data = await res.json();
      setFetchedMemory(data.memory);
    } catch (err: any) {
      console.error('[ChainMemory] Error fetching memory detail:', err);
      setFetchError(err.message || 'Failed to retrieve memory chunk from 0G storage indexer.');
    } finally {
      setFetchingMemoryHash(null);
    }
  };

  // Async save to 0G storage
  const saveMessageTo0G = async (msgId: string, role: 'user' | 'assistant', content: string) => {
    try {
      const timestamp = new Date().toISOString();
      
      // Step 2: Merkle Hash
      setActiveStep(2);
      
      const saveRes = await fetch('/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, content, timestamp }),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || `Server HTTP error ${saveRes.status}`);
      }

      // Step 3: Storage Nodes
      setActiveStep(3);
      const { rootHash, txHash } = await saveRes.json();

      // Step 4: EVM Registry
      setActiveStep(4);
      
      const indexRes = await fetch('/api/memory/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          rootHash,
          timestamp,
          preview: content.substring(0, 60) + (content.length > 60 ? '...' : ''),
        }),
      });

      if (!indexRes.ok) {
        throw new Error('Failed to update memory index.');
      }

      // Mark as saved
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId ? { ...m, status: 'saved', rootHash, txHash } : m
        )
      );

      // Reload sidebar index
      fetchTimeline();
      
      // Step 5: Success Verification
      setActiveStep(5);
      setTimeout(() => setActiveStep(null), 1500);

    } catch (err: any) {
      console.error(`[ChainMemory] Failed saving ${role} message to 0G:`, err);
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId ? { ...m, status: 'failed' } : m
        )
      );
      setActiveStep(null);
    }
  };

  const handleRetrySave = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, status: 'saving' } : m))
    );

    enqueueUpload(msgId, msg.role, msg.content);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userText = input.trim();
    setInput('');

    const userMsgId = `msg_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: userText,
      status: 'saving',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    // Enqueue save of user message to 0G sequentially
    enqueueUpload(userMsgId, 'user', userText);

    try {
      setActiveStep(1); // Step 1: AI Chat Execution
      
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!chatRes.ok) {
        const errData = await chatRes.json();
        throw new Error(errData.error || 'Failed to fetch AI completion');
      }

      const { reply } = await chatRes.json();

      const assistantMsgId = `msg_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: reply,
        status: 'saving',
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsGenerating(false);

      // Enqueue save of assistant reply to 0G sequentially
      enqueueUpload(assistantMsgId, 'assistant', reply);

    } catch (err: any) {
      console.error('[ChainMemory] Chat API error:', err);
      setIsGenerating(false);
      
      const assistantMsgId = `msg_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: `Error: ${err.message || 'Something went wrong while communicating with Groq.'}`,
          status: 'failed',
        },
      ]);
    }
  };

  const scrollToConsole = () => {
    chatConsoleRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Staggered load animation config
  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 70 } }
  };

  const isAnySaving = messages.some(m => m.status === 'saving');
  const lastSavedMessage = [...messages].reverse().find(m => m.status === 'saved');

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-emerald-500/30 selection:text-emerald-300 bg-grid-dots relative transition-colors duration-300">
      
      {/* Dynamic glow grids */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--accent-glow),_transparent_60%)] pointer-events-none"></div>

      {/* 1. FIXED GLASS NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 h-16 border-b border-card-border bg-background/75 backdrop-blur-md z-40 px-6 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-sm text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Brain className="h-4 w-4 text-black" />
          </div>
          <span className="text-md font-bold tracking-tight text-foreground flex items-center gap-1.5">
            Chain<span className="text-emerald-500 dark:text-emerald-400 font-light">Memory</span>
          </span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-semibold">
          <a href="#features" className="text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Features
          </a>
          <a href="#architecture" className="text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Layers className="h-3 w-3" /> Architecture
          </a>
          <a href="#console" onClick={scrollToConsole} className="text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Terminal className="h-3 w-3" /> Console Playground
          </a>
        </div>

        {/* Network status badges & Theme toggle */}
        <div className="flex items-center space-x-3">
          {/* Light/Dark Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg border border-card-border bg-card-bg text-foreground hover:text-emerald-500 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-sm"
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/5 dark:bg-[#0f2116] border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Activity className="h-3 w-3 mr-1.5 animate-pulse text-emerald-500" />
            0G Storage Active
          </span>
          {config.contractAddress ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/5 dark:bg-[#141235] border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Shield className="h-3 w-3 sm:mr-1.5 text-indigo-500" />
              <span className="hidden sm:inline">On-Chain Indexer</span>
              <span className="inline sm:hidden">On-Chain</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-500">
              Local fallback
            </span>
          )}
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative pt-36 pb-20 px-6 flex flex-col items-center justify-center overflow-hidden border-b border-card-border bg-[radial-gradient(ellipse_at_top,_var(--accent-glow),_transparent_80%)]">
        {/* Velfi-inspired dot grid pattern */}
        <div className="absolute inset-0 bg-grid-dots z-0 pointer-events-none opacity-40 dark:opacity-25" />
        
        {/* Soft, colorful radial glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-gradient-to-b from-emerald-500/8 via-emerald-500/3 to-transparent blur-[120px] pointer-events-none z-0" />
        
        <motion.div 
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl text-center z-10 space-y-6"
        >
          <motion.div 
            variants={heroItemVariants}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-noise-grain backdrop-blur-sm"
          >
            <Sparkles className="h-3 w-3 text-emerald-500 dark:text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} /> 0G Zero Cup Submission
          </motion.div>

          <motion.h1 
            variants={heroItemVariants}
            className="text-5xl md:text-7.5xl font-display font-bold tracking-tight leading-[1.05]"
          >
            Decentralized Sovereign <br/>
            <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300 bg-clip-text text-transparent animate-text-gradient bg-[length:200%_200%]">
              AI Agent Memory
            </span>
          </motion.h1>

          <motion.p 
            variants={heroItemVariants}
            className="text-gray-800 dark:text-gray-300 max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
          >
            Stop relying on centralized databases. ChainMemory anchors your AI agent&apos;s conversation history directly onto 0G Storage nodes, signed securely and indexed on the 0G Testnet EVM.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            variants={heroItemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button
              onClick={scrollToConsole}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-500 text-white dark:text-black font-semibold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
            >
              Open Agent Console
              <ArrowRight className="h-4 w-4" />
            </button>
            {config.contractAddress && (
              <button
                onClick={() => handleCopyText(config.contractAddress, 'Registry Address')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-card-border/80 bg-card-bg/60 text-xs font-mono text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer hover:border-emerald-500/20 shadow-sm bg-noise-grain backdrop-blur-md"
              >
                <span>Registry: {config.contractAddress.substring(0, 8)}...{config.contractAddress.slice(-6)}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {copiedText === 'Registry Address' ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : 'Copy'}
                </span>
              </button>
            )}
          </motion.div>
        </motion.div>

        {/* Live Network Metrics Grid */}
        <div className="max-w-4xl w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 z-10 px-4">
          <div className="bg-card-bg/60 border border-card-border/80 p-4 rounded-xl text-center space-y-1 backdrop-blur-md shadow-md bg-noise-grain">
            <span className="block text-[10px] font-semibold text-gray-700 dark:text-gray-400 uppercase font-mono tracking-wider">Index Blocks</span>
            <span className="block text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{historyList.length}</span>
          </div>
          <div className="bg-card-bg/60 border border-card-border/80 p-4 rounded-xl text-center space-y-1 backdrop-blur-md shadow-md bg-noise-grain">
            <span className="block text-[10px] font-semibold text-gray-700 dark:text-gray-400 uppercase font-mono tracking-wider">DA Layer</span>
            <span className="block text-xs font-bold text-foreground font-mono truncate" title={config.indexerRpc}>0G Storage Indexer</span>
          </div>
          <div className="bg-card-bg/60 border border-card-border/80 p-4 rounded-xl text-center space-y-1 backdrop-blur-md shadow-md bg-noise-grain">
            <span className="block text-[10px] font-semibold text-gray-700 dark:text-gray-400 uppercase font-mono tracking-wider">Registry Network</span>
            <span className="block text-xs font-bold text-foreground font-mono truncate">0G Testnet EVM</span>
          </div>
          <div className="bg-card-bg/60 border border-card-border/80 p-4 rounded-xl text-center space-y-1 backdrop-blur-md shadow-md bg-noise-grain">
            <span className="block text-[10px] font-semibold text-gray-700 dark:text-gray-400 uppercase font-mono tracking-wider">Registry Type</span>
            <span className="block text-xs font-bold text-indigo-650 dark:text-indigo-400 font-mono uppercase tracking-wide">Solidity Contract</span>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT FEATURES GRID */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto space-y-16 relative">
        {/* Subtle glow backdrop under features */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-500/2 dark:bg-emerald-500/3 blur-[100px] pointer-events-none z-0" />
        
        <div className="text-center space-y-2 relative z-10">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">Sovereign Architecture Features</h2>
          <p className="text-xs text-gray-800 dark:text-gray-300 max-w-lg mx-auto">Built from the ground up for privacy, performance, and absolute decentralization.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative z-10">
          {/* Card 1 */}
          <motion.div 
            whileHover={{ y: -6, scale: 1.01, borderColor: "rgba(16, 185, 129, 0.3)" }}
            className="p-6 rounded-2xl border border-card-border bg-card-bg/60 backdrop-blur-sm transition-all space-y-3 shadow-md bg-noise-grain"
          >
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative z-10">
              <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-foreground relative z-10">0G Storage Integration</h3>
            <p className="text-xs text-gray-700 dark:text-gray-400 leading-relaxed relative z-10">
              Every turn of the conversation is serialized to JSON and stored directly on 0G Storage Nodes as content-addressed files. Validated using Merkle roots.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            whileHover={{ y: -6, scale: 1.01, borderColor: "rgba(99, 102, 241, 0.3)" }}
            className="p-6 rounded-2xl border border-card-border bg-card-bg/60 backdrop-blur-sm transition-all space-y-3 shadow-md bg-noise-grain"
          >
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center relative z-10">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-foreground relative z-10">On-Chain Solidity Registry</h3>
            <p className="text-xs text-gray-700 dark:text-gray-400 leading-relaxed relative z-10">
              No central indexer. All block hashes and timestamps are registered inside an EVM smart contract (`MemoryRegistry.sol`) on 0G Testnet for total transparency.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div 
            whileHover={{ y: -6, scale: 1.01, borderColor: "rgba(245, 158, 11, 0.3)" }}
            className="p-6 rounded-2xl border border-card-border bg-card-bg/60 backdrop-blur-sm transition-all space-y-3 shadow-md bg-noise-grain"
          >
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center relative z-10">
              <Cpu className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-foreground relative z-10">Atomic Nonce Engine</h3>
            <p className="text-xs text-gray-700 dark:text-gray-400 leading-relaxed relative z-10">
              Equipped with a client-side sequential upload queue to serialize EVM transactions, completely bypassing pending nonce conflicts (`REPLACEMENT_UNDERPRICED`).
            </p>
          </motion.div>
        </div>
      </section>

      {/* 4. INTERACTIVE HOW IT WORKS VISUALIZATION */}
      <section id="architecture" className="py-24 px-6 border-t border-card-border bg-card-bg/20 relative overflow-hidden">
        {/* Grid and radial light on section */}
        <div className="absolute inset-0 bg-grid-dots z-0 pointer-events-none opacity-20 dark:opacity-10" />
        <div className="absolute top-0 right-[-10%] w-[400px] h-[400px] bg-emerald-500/2 dark:bg-emerald-500/3 blur-[120px] pointer-events-none z-0" />
        
        <div className="max-w-6xl mx-auto space-y-16 relative z-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">How Memory Stacking Works</h2>
            <p className="text-xs text-gray-700 dark:text-gray-300 max-w-lg mx-auto">Click a step below to visualize the data flow of sovereign memory.</p>
          </div>

          {/* Interactive Steps Map */}
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:pb-0 md:grid md:grid-cols-5 scrollbar-none relative z-10 mx-[-1.5rem] px-6 md:mx-0 md:px-0">
            
            {/* Connection Line decoration */}
            <div className="absolute top-1/2 left-4 right-4 h-0.5 border-t border-dashed border-card-border -translate-y-1/2 hidden md:block z-0"></div>

            {/* Step 1 */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveStep(1)}
              className={`snap-center flex-shrink-0 w-[78%] sm:w-[50%] md:w-auto p-4 rounded-xl border z-10 cursor-pointer transition-all bg-noise-grain backdrop-blur-sm ${activeStep === 1 ? 'border-emerald-500 bg-emerald-500/8 dark:bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-card-border bg-card-bg hover:border-emerald-500/35'}`}
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono uppercase">Step 01</span>
                <Brain className={`h-3.5 w-3.5 ${activeStep === 1 ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-gray-700 dark:text-gray-400'}`} />
              </div>
              <h4 className="text-xs font-bold text-foreground mb-1 relative z-10">Chat Generation</h4>
              <p className="text-[10px] text-gray-700 dark:text-gray-400 leading-normal relative z-10">Groq executes Llama-3.3-70b inside the API route.</p>
            </motion.div>

            {/* Step 2 */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveStep(2)}
              className={`snap-center flex-shrink-0 w-[78%] sm:w-[50%] md:w-auto p-4 rounded-xl border z-10 cursor-pointer transition-all bg-noise-grain backdrop-blur-sm ${activeStep === 2 ? 'border-emerald-500 bg-emerald-500/8 dark:bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-card-border bg-card-bg hover:border-emerald-500/35'}`}
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono uppercase">Step 02</span>
                <FileJson className={`h-3.5 w-3.5 ${activeStep === 2 ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-gray-700 dark:text-gray-400'}`} />
              </div>
              <h4 className="text-xs font-bold text-foreground mb-1 relative z-10">Merkle Proofing</h4>
              <p className="text-[10px] text-gray-700 dark:text-gray-400 leading-normal relative z-10">Bytes are encoded into MemData, creating a Merkle root hash.</p>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveStep(3)}
              className={`snap-center flex-shrink-0 w-[78%] sm:w-[50%] md:w-auto p-4 rounded-xl border z-10 cursor-pointer transition-all bg-noise-grain backdrop-blur-sm ${activeStep === 3 ? 'border-emerald-500 bg-emerald-500/8 dark:bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-card-border bg-card-bg hover:border-emerald-500/35'}`}
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono uppercase">Step 03</span>
                <Database className={`h-3.5 w-3.5 ${activeStep === 3 ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-gray-700 dark:text-gray-400'}`} />
              </div>
              <h4 className="text-xs font-bold text-foreground mb-1 relative z-10">0G Storage Push</h4>
              <p className="text-[10px] text-gray-700 dark:text-gray-400 leading-normal relative z-10">The indexer writes raw bytes securely across storage nodes.</p>
            </motion.div>

            {/* Step 4 */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveStep(4)}
              className={`snap-center flex-shrink-0 w-[78%] sm:w-[50%] md:w-auto p-4 rounded-xl border z-10 cursor-pointer transition-all bg-noise-grain backdrop-blur-sm ${activeStep === 4 ? 'border-emerald-500 bg-emerald-500/8 dark:bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-card-border bg-card-bg hover:border-emerald-500/35'}`}
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono uppercase">Step 04</span>
                <Layers className={`h-3.5 w-3.5 ${activeStep === 4 ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-gray-700 dark:text-gray-400'}`} />
              </div>
              <h4 className="text-xs font-bold text-foreground mb-1 relative z-10">On-Chain Anchor</h4>
              <p className="text-[10px] text-gray-700 dark:text-gray-400 leading-normal relative z-10">EVM writes reference rootHash and timestamp to Solidity registry.</p>
            </motion.div>

            {/* Step 5 */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveStep(5)}
              className={`snap-center flex-shrink-0 w-[78%] sm:w-[50%] md:w-auto p-4 rounded-xl border z-10 cursor-pointer transition-all bg-noise-grain backdrop-blur-sm ${activeStep === 5 ? 'border-emerald-500 bg-emerald-500/8 dark:bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-card-border bg-card-bg hover:border-emerald-500/35'}`}
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono uppercase">Step 05</span>
                <Search className={`h-3.5 w-3.5 ${activeStep === 5 ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-gray-700 dark:text-gray-400'}`} />
              </div>
              <h4 className="text-xs font-bold text-foreground mb-1 relative z-10">Recall Verification</h4>
              <p className="text-[10px] text-gray-700 dark:text-gray-400 leading-normal relative z-10">Click timeline: client requests fetch route to pull and decode memory.</p>
            </motion.div>

          </div>

          {/* Mobile Swipe Hint */}
          <div className="flex md:hidden items-center justify-center gap-1.5 text-[10px] text-gray-700 dark:text-gray-400 font-medium pb-2 select-none">
            <span>Swipe steps</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500/60 animate-pulse"></span>
            <span className="w-1 h-1 rounded-full bg-emerald-500/40"></span>
            <span className="w-1 h-1 rounded-full bg-emerald-500/20"></span>
          </div>

          {/* Dynamic Map Detail Card */}
          <div className="bg-card-bg/60 border border-card-border rounded-2xl p-6 min-h-[120px] flex items-center justify-between gap-6 shadow-md bg-noise-grain backdrop-blur-md relative z-10">
            <div className="space-y-1.5 max-w-2xl relative z-10">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {activeStep === null ? 'System Active' : `Phase Details: Step 0${activeStep}`}
              </h4>
              <p className="text-xs text-gray-800 dark:text-gray-300 leading-relaxed">
                {activeStep === null && 'Click on any step or interact with the playground below. The visual nodes light up automatically during the save and recall lifecycle.'}
                {activeStep === 1 && 'When you click Send, the user message text is pushed directly to the next.js chat endpoint. Groq executes Llama-3.3-70b inside the API route.'}
                {activeStep === 2 && 'Before submitting, we convert the JSON string into standard UTF-8 bytes and feed them into the SDK. This generates leaf hashes and compiles them to compute a single content-addressed rootHash.'}
                {activeStep === 3 && 'The Next.js backend establishes connection with the 0G storage indexer, broadcasting files with Merkle proofs across nodes. This guarantees high DA speed and permanent access.'}
                {activeStep === 4 && 'The storage transaction hash is anchored by sending an EVM transaction to the registry contract. It logs events and maps references, making storage indices globally queryable.'}
                {activeStep === 5 && 'By selecting a timeline hash, the Next.js server calls indexer.download to grab the Merkle tree from 0G storage, parses the payload, and displays it in the inspector console.'}
              </p>
            </div>
            <div className="hidden sm:block flex-shrink-0 relative z-10">
              <span className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                {activeStep === null ? 'Idle' : `Active`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PLAYGROUND & EMBEDDED CONSOLE */}
      <section id="console" ref={chatConsoleRef} className="py-24 px-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 relative">
        {/* Ambient glow behind console */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/2 dark:bg-emerald-500/4 blur-[130px] pointer-events-none z-0" />
        
        <div className="text-center space-y-2 relative z-10">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">Playground Console</h2>
          <p className="text-xs text-gray-800 dark:text-gray-300 max-w-lg mx-auto">Interact with the AI agent below and watch data sync to 0G in real-time.</p>
        </div>

        {/* Embedded Console Panel */}
        <div className="w-full border border-card-border bg-console-bg rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-[650px] relative transition-colors duration-300 bg-noise-grain z-10">
          
          {/* Console Header Bar */}
          <div className="h-12 bg-console-header border-b border-card-border px-4 flex items-center justify-between flex-shrink-0 transition-colors duration-300 relative z-10">
            {/* Mock Mac Buttons */}
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/40"></span>
              <span className="h-3 w-3 rounded-full bg-amber-500/40"></span>
              <span className="h-3 w-3 rounded-full bg-emerald-500/40"></span>
              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono pl-3 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                chain-memory-console // {sessionId.substring(0, 15)}...
              </span>
            </div>
            
            {/* Toggle Timeline Button */}
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="text-xs font-mono px-3 py-1.5 bg-card-bg hover:bg-card-border border border-card-border text-foreground rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm relative z-10 bg-noise-grain"
            >
              {showTimeline ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showTimeline ? 'Hide Memory Timeline' : `Show Memory Timeline (${historyList.length})`}</span>
              <span className="inline sm:hidden">{showTimeline ? 'Hide' : `Memory (${historyList.length})`}</span>
            </button>
          </div>

          {/* Console Body Area */}
          <div className="flex-1 flex overflow-hidden relative z-10">
            
            {/* Timeline Pane (Left) - Animates with Framer Motion layout prop */}
            <AnimatePresence initial={false}>
              {showTimeline && (
                <motion.div
                  key="timeline-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowTimeline(false)}
                  className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-20 md:hidden cursor-pointer"
                />
              )}
              {showTimeline && (
                <motion.div 
                  key="timeline-sidebar"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 288, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, type: 'tween' }}
                  className="absolute md:relative inset-y-0 left-0 z-30 h-full w-[288px] max-w-[85vw] border-r border-card-border flex flex-col flex-shrink-0 overflow-hidden bg-timeline-bg transition-colors duration-300 bg-noise-grain shadow-2xl md:shadow-none"
                >
                  <div className="p-3 border-b border-card-border flex items-center justify-between text-xs text-gray-800 dark:text-gray-400 font-mono">
                    <span className="flex items-center gap-1"><Database className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> 0G REGISTRY INDEX</span>
                    <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">{historyList.length}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {historyList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <span className="text-xs text-gray-750 dark:text-gray-400 font-mono italic">No transaction registry entries</span>
                      </div>
                    ) : (
                      historyList.map((item, idx) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          key={`${item.rootHash}-${idx}`}
                          onClick={() => handleInspectMemory(item)}
                          className="group flex flex-col p-2.5 rounded-lg border border-card-border bg-console-bg hover:bg-chat-bg hover:border-emerald-500/20 transition-all cursor-pointer shadow-sm bg-noise-grain"
                        >
                          <div className="flex justify-between items-center text-[10px] text-gray-700 dark:text-gray-400 font-mono mb-1">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-0.5">
                              <Layers className="h-2 w-2" /> 0G Node
                            </span>
                            <span>{formatDate(item.timestamp)}</span>
                          </div>
                          <p className="text-xs text-gray-800 dark:text-gray-300 line-clamp-1 leading-normal mb-1.5">
                            {item.preview}
                          </p>
                          <div 
                            onClick={(e) => handleCopyHash(e, item.rootHash)}
                            className="flex items-center justify-between text-[10px] font-mono bg-chat-bg border border-card-border px-1.5 py-0.5 rounded hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            <span className="truncate max-w-[130px] text-gray-700 dark:text-gray-400">
                              root: {item.rootHash.substring(0, 8)}...{item.rootHash.slice(-6)}
                            </span>
                            <span className="text-[9px] text-gray-700 dark:text-gray-400 font-sans">
                              {copiedHash === item.rootHash ? 'Copied' : 'Copy'}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Conversation Area (Right) */}
            <div className="flex-1 flex flex-col bg-chat-bg relative transition-colors duration-300">
              
              {/* Message History Thread */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                ref={messagesEndRef}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <Brain className="h-8 w-8 text-gray-600 dark:text-gray-500 animate-pulse" />
                    <p className="text-sm font-bold text-foreground">Initiate Agent Session</p>
                    <p className="text-xs text-gray-700 dark:text-gray-400 max-w-[320px] leading-relaxed">
                      Ask a question or request a task. Every conversation step is parsed, signed, and uploaded to 0G storage nodes in real-time.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      key={msg.id || idx}
                      className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      {/* Sender Tag */}
                      <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                        {msg.role === 'user' ? 'YOU (SESSION WALLET)' : 'CHAINMEMORY_AGENT'}
                      </span>

                      {/* Chat Bubble */}
                      <div 
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border transition-all ${
                          msg.role === 'user' 
                            ? 'bg-bubble-user border-bubble-user-border text-foreground rounded-tr-none' 
                            : 'bg-bubble-ai border-bubble-ai-border text-foreground rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-1.5 mt-1 text-[9.5px] font-mono text-gray-600 dark:text-gray-400">
                        {msg.status === 'saving' && (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                            <RefreshCw className="h-2 w-2 animate-spin" /> Anchoring on 0G Storage...
                          </span>
                        )}
                        {msg.status === 'saved' && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="h-2.5 w-2.5" /> Block Saved ({msg.rootHash?.substring(0, 6)}...)
                          </span>
                        )}
                        {msg.status === 'failed' && (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            ⚠️ Anchoring failed
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col mr-auto items-start max-w-[85%]"
                  >
                    <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 mb-1">
                      CHAINMEMORY_AGENT
                    </span>
                    <div className="px-4 py-3 rounded-2xl text-sm bg-bubble-ai border border-bubble-ai-border text-foreground rounded-tl-none flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSend} className="p-4 border-t border-card-border bg-console-bg flex items-center gap-2 z-10 transition-colors duration-300">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isGenerating || isAnySaving ? "Operations pending..." : "Ask the agent anything..."}
                  disabled={isGenerating || isAnySaving}
                  className="flex-1 bg-input-bg border border-card-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-emerald-500/40 transition-colors placeholder-gray-500 disabled:opacity-50 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating || isAnySaving}
                  className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-400 dark:hover:bg-emerald-500 text-white dark:text-black transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-emerald-500 cursor-pointer shadow-sm flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

            </div>

          </div>
        </div>

        {/* Real-Time Status Bar under the playground */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-gray-600 dark:text-gray-400 px-4 space-y-2 sm:space-y-0 relative z-10">
          <div className="flex items-center space-x-4">
            {isAnySaving ? (
              <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Atomic upload queue running...
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Storage engine idle (ready)
              </span>
            )}
            <span>Session: <code className="text-foreground bg-card-bg px-1.5 py-0.5 rounded">{sessionId ? sessionId.substring(0, 12) : 'initializing'}</code></span>
          </div>
          <div>
            {lastSavedMessage && lastSavedMessage.rootHash && (
              <span>Last rootHash: <code className="text-foreground bg-card-bg px-1.5 py-0.5 rounded truncate inline-block max-w-[150px] align-bottom" title={lastSavedMessage.rootHash}>{lastSavedMessage.rootHash}</code></span>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-card-border bg-card-bg/25 text-center text-xs text-gray-600 dark:text-gray-400 space-y-2 relative z-10">
        <p>ChainMemory © 2026. Stored permanently on 0G Storage Nodes.</p>
        <p className="text-[10px] text-gray-600 dark:text-gray-500">Built for the 0G Zero Cup Hackathon. Total Sovereign Decentralized AI Memory.</p>
      </footer>

      {/* INSPECTION DETAIL MODAL */}
      <AnimatePresence>
        {showDetailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.18, type: 'tween' }}
              className="w-full max-w-2xl bg-console-bg border border-card-border rounded-xl shadow-2xl flex flex-col overflow-hidden bg-noise-grain"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-card-border bg-console-header flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm tracking-wide text-foreground uppercase font-mono flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                    0G Storage Node Block Details
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-400 mt-0.5">Retrieved via indexer.download from decentralized nodes</p>
                </div>
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    setFetchedMemory(null);
                    setFetchError(null);
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-xs font-bold bg-gray-100 dark:bg-[#1b1b26] hover:bg-gray-200 dark:hover:bg-[#252535] h-6 w-6 flex items-center justify-center rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 flex-1 overflow-y-auto min-h-[300px]">
                {fetchingMemoryHash ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 space-y-3">
                    <RefreshCw className="h-5 w-5 text-emerald-500 animate-spin" />
                    <span className="text-xs text-gray-700 dark:text-gray-400 font-mono animate-pulse">Downloading blocks from 0G storage indexer...</span>
                  </div>
                ) : fetchError ? (
                  <div className="bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-sm p-4 rounded-lg font-mono space-y-2">
                    <p className="font-bold">❌ Download Failed</p>
                    <p className="text-gray-700 dark:text-gray-400">{fetchError}</p>
                    <div className="text-xs text-gray-700 pt-2 border-t border-rose-500/10">
                      Suggestions: Ensure the EVM block was finalized, the indexer was updated, and network latency is stable.
                    </div>
                  </div>
                ) : fetchedMemory ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Meta Details */}
                    <div className="grid grid-cols-2 gap-3 bg-chat-bg border border-card-border p-3 rounded-lg text-xs font-mono">
                      <div>
                        <span className="block text-gray-600 dark:text-gray-400">Session ID</span>
                        <span className="text-foreground truncate block">{fetchedMemory.sessionId}</span>
                      </div>
                      <div>
                        <span className="block text-gray-600 dark:text-gray-400">Node Role</span>
                        <span className={`capitalize font-bold ${fetchedMemory.role === 'user' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                          {fetchedMemory.role}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-gray-600 dark:text-gray-400">Storage Timestamp</span>
                        <span className="text-foreground">{formatDate(fetchedMemory.timestamp)}</span>
                      </div>
                    </div>

                    {/* Message Content */}
                    <div>
                      <span className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Payload Content</span>
                      <div className="bg-chat-bg border border-card-border p-4 rounded-lg text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {fetchedMemory.content}
                      </div>
                    </div>

                    {/* raw JSON preview */}
                    <div>
                      <span className="block text-[10px] font-mono text-gray-600 dark:text-gray-400 mb-1">Raw Decentralized Metadata</span>
                      <pre className="bg-chat-bg/80 border border-card-border p-3 rounded-lg text-[10px] text-emerald-500 dark:text-emerald-400/90 overflow-x-auto font-mono">
                        {JSON.stringify(fetchedMemory, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">No data loaded</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-console-header border-t border-card-border flex justify-end">
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    setFetchedMemory(null);
                    setFetchError(null);
                  }}
                  className="px-4 py-2 text-sm bg-card-bg hover:bg-card-border text-foreground rounded font-semibold transition-colors cursor-pointer border border-card-border shadow-sm"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
