import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  CreditCard, 
  Ticket, 
  Share2, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  Sparkles, 
  Check, 
  Copy, 
  Calendar, 
  FileText, 
  Info, 
  ExternalLink,
  Wifi,
  WifiOff,
  Sun,
  X,
  Camera,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react';
import { Card, StorePreset } from './types';
import { STORE_PRESETS, BARCODE_TYPES } from './presets';
import { BarcodeRenderer } from './components/BarcodeRenderer';
import { BarcodeScanner } from './components/BarcodeScanner';

// Simple custom ID generator (safe, offline-capable)
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Auto-detect barcode layout format based on input
function detectBarcodeType(code: string): 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR' {
  const clean = code.trim();
  if (!clean) return 'CODE128';
  
  // URL or typical long identifier implies QR Code
  if (/^(https?:\/\/|ftp:\/\/|mailto:|tel:)/i.test(clean) || (clean.length > 25 && /[/:?=&]/.test(clean))) {
    return 'QR';
  }
  
  // Remove spaces or dashes commonly used in card numbers
  const digitsOnly = clean.replace(/[\s-]/g, '');
  
  // If it is numeric only
  if (/^\d+$/.test(digitsOnly)) {
    if (digitsOnly.length === 13) return 'EAN13';
    if (digitsOnly.length === 8) return 'EAN8';
    if (digitsOnly.length === 12) return 'UPCA';
  }
  
  // Default fallback for general alphanumeric barcodes
  return 'CODE128';
}

export default function App() {
  // State initialization
  const [cards, setCards] = useState<Card[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'loyalty' | 'coupons'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation states
  const [currentView, setCurrentView] = useState<'dashboard' | 'add' | 'view' | 'edit' | 'share'>('dashboard');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Form states
  const [formStorePreset, setFormStorePreset] = useState<string>('');
  const [formStoreName, setFormStoreName] = useState('');
  const [formCardName, setFormCardName] = useState('');
  const [formCardNumber, setFormCardNumber] = useState('');
  const [formBarcodeType, setFormBarcodeType] = useState<'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR'>('CODE128');
  const [formColor, setFormColor] = useState('bg-slate-700 border border-slate-800/10');
  const [formNotes, setFormNotes] = useState('');
  const [formIsCoupon, setFormIsCoupon] = useState(false);
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [showAdvancedBarcode, setShowAdvancedBarcode] = useState(false);

  // Sharing states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local' | 'error'>('synced');
  
  // Dynamic Route / Import Shared Card state
  const [sharedCardId, setSharedCardId] = useState<string | null>(null);
  const [sharedCard, setSharedCard] = useState<Card | null>(null);
  const [isFetchingShared, setIsFetchingShared] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);

  // Load cards from SQLite on mount with local storage fallback/cache
  useEffect(() => {
    const loadCards = async () => {
      const localCards = localStorage.getItem('card_wallet_cards');
      if (localCards) {
        try {
          setCards(JSON.parse(localCards));
        } catch (e) {
          console.error('Error parsing local cards', e);
        }
      }

      setIsSyncing(true);
      try {
        const response = await fetch('/api/cards');
        if (response.ok) {
          const serverCards = await response.json();
          if (Array.isArray(serverCards)) {
            setCards(serverCards);
            localStorage.setItem('card_wallet_cards', JSON.stringify(serverCards));
            setSyncStatus('synced');
          }
        }
      } catch (err) {
        console.error('Failed to load cards from SQLite backend:', err);
        setSyncStatus('error');
      } finally {
        setIsSyncing(false);
      }
    };

    loadCards();

    // Check if loading as a shared card (/share/:id)
    const path = window.location.pathname;
    const shareMatch = path.match(/\/share\/([a-zA-Z0-9]+)/);
    if (shareMatch && shareMatch[1]) {
      const cardId = shareMatch[1];
      setSharedCardId(cardId);
      setCurrentView('share');
      fetchSharedCard(cardId);
    }
  }, []);

  // Save cards to localStorage when they change
  const saveCardsLocally = (newCards: Card[]) => {
    setCards(newCards);
    localStorage.setItem('card_wallet_cards', JSON.stringify(newCards));
  };

  // Fetch a shared card from server SQLite
  const fetchSharedCard = async (id: string) => {
    setIsFetchingShared(true);
    setSharedError(null);
    try {
      const response = await fetch(`/api/cards/${id}`);
      if (!response.ok) {
        throw new Error('Shared card not found in database.');
      }
      const data: Card = await response.json();
      setSharedCard(data);
    } catch (err: any) {
      console.error(err);
      setSharedError(err.message || 'Could not fetch the shared card.');
    } finally {
      setIsFetchingShared(false);
    }
  };

  // Sync a single card to SQLite on the server
  const uploadCardToServer = async (card: Card, quiet = false) => {
    if (!quiet) setIsSyncing(true);
    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(card)
      });
      
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      
      if (!quiet) setSyncStatus('synced');
    } catch (err) {
      console.error('Failed to sync card with SQLite:', err);
      if (!quiet) setSyncStatus('error');
    } finally {
      if (!quiet) setIsSyncing(false);
    }
  };

  // Sync all unsynced cards (helper)
  const syncAllCards = async () => {
    setIsSyncing(true);
    let success = true;
    for (const card of cards) {
      try {
        await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(card)
        });
      } catch (e) {
        success = false;
      }
    }
    setSyncStatus(success ? 'synced' : 'error');
    setIsSyncing(false);
  };

  // Handle store preset selection inside the add/edit forms
  const handlePresetChange = (presetId: string) => {
    setFormStorePreset(presetId);
    const preset = STORE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setFormStoreName(preset.name === 'Other / Custom Store' ? '' : preset.name);
      setFormCardName(preset.name === 'Other / Custom Store' ? 'Custom Card' : `${preset.name} Card`);
      setFormBarcodeType(preset.defaultBarcodeType);
      setFormColor(preset.color);
    }
  };

  // Handle card number change and automatically detect barcode format
  const handleCardNumberChange = (value: string) => {
    setFormCardNumber(value);
    const guessedType = detectBarcodeType(value);
    setFormBarcodeType(guessedType);
  };

  // Add Card action
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStoreName.trim()) return;
    if (!formCardNumber.trim()) return;

    const newCard: Card = {
      id: generateShortId(),
      name: formCardName,
      store: formStoreName,
      cardNumber: formCardNumber,
      barcodeType: formBarcodeType,
      color: formColor,
      notes: formNotes,
      isCoupon: formIsCoupon,
      expiryDate: formIsCoupon ? formExpiryDate : undefined,
      createdAt: new Date().toISOString()
    };

    const updatedCards = [newCard, ...cards];
    saveCardsLocally(updatedCards);
    
    // Sync to SQLite
    uploadCardToServer(newCard);

    // Reset Form
    resetForm();
    setCurrentView('dashboard');
  };

  // Edit Card action
  const handleUpdateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;

    const updatedCard: Card = {
      ...selectedCard,
      name: formCardName,
      store: formStoreName,
      cardNumber: formCardNumber,
      barcodeType: formBarcodeType,
      color: formColor,
      notes: formNotes,
      isCoupon: formIsCoupon,
      expiryDate: formIsCoupon ? formExpiryDate : undefined
    };

    const updatedCards = cards.map(c => c.id === selectedCard.id ? updatedCard : c);
    saveCardsLocally(updatedCards);
    
    // Sync to SQLite
    uploadCardToServer(updatedCard);

    setSelectedCard(updatedCard);
    setIsModalOpen(true);
    setCurrentView('dashboard');
  };

  // Handle successful barcode scan
  const handleScanSuccess = (code: string, format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR') => {
    setFormCardNumber(code);
    if (format) {
      setFormBarcodeType(format);
    }
    setIsScannerOpen(false);
  };

  // Delete Card action
  const handleDeleteCard = async (cardId: string) => {
    if (confirm('Are you sure you want to delete this card from your wallet?')) {
      const updatedCards = cards.filter(c => c.id !== cardId);
      saveCardsLocally(updatedCards);
      
      try {
        await fetch(`/api/cards/${cardId}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.error('Failed to delete card from SQLite backend:', err);
      }
      
      setCurrentView('dashboard');
      setSelectedCard(null);
      setIsModalOpen(false);
    }
  };

  // Import shared card into current user's local storage wallet
  const handleImportSharedCard = () => {
    if (!sharedCard) return;
    
    // Check if card is already in wallet
    if (cards.some(c => c.id === sharedCard.id)) {
      alert('This card is already stored in your wallet!');
      setCurrentView('dashboard');
      return;
    }

    const updatedCards = [sharedCard, ...cards];
    saveCardsLocally(updatedCards);
    
    // Switch view
    setCurrentView('dashboard');
    alert(`Successfully imported "${sharedCard.name}"!`);
    
    // Remove query path from window URL to restore clean root url without page reload
    window.history.pushState({}, '', '/');
    setSharedCardId(null);
    setSharedCard(null);
  };

  const resetForm = () => {
    setFormStorePreset('');
    setFormStoreName('');
    setFormCardName('');
    setFormBarcodeType('CODE128');
    setFormColor('bg-slate-700 border border-slate-800/10');
    setFormCardNumber('');
    setFormNotes('');
    setFormIsCoupon(false);
    setFormExpiryDate('');
  };

  const loadCardForEdit = (card: Card) => {
    setSelectedCard(card);
    setFormStoreName(card.store);
    setFormCardName(card.name);
    setFormCardNumber(card.cardNumber);
    setFormBarcodeType(card.barcodeType);
    setFormColor(card.color);
    setFormNotes(card.notes || '');
    setFormIsCoupon(card.isCoupon);
    setFormExpiryDate(card.expiryDate || '');
    setCurrentView('edit');
    setIsModalOpen(false);
  };

  // Filter & Search logic
  const filteredCards = cards.filter(card => {
    const matchesSearch = 
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.store.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.cardNumber.includes(searchQuery);
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'loyalty') return matchesSearch && !card.isCoupon;
    if (activeTab === 'coupons') return matchesSearch && card.isCoupon;
    return matchesSearch;
  });

  // Share Card Copy Link action
  const handleShareCard = (card: Card) => {
    const shareUrl = `${window.location.origin}/share/${card.id}`;
    
    // Attempt background upload just in case it wasn't uploaded before
    uploadCardToServer(card, true);

    if (navigator.share) {
      navigator.share({
        title: `${card.name} - Shared via Card Wallet`,
        text: `Here is the card details for ${card.store}`,
        url: shareUrl
      }).catch(err => {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
          setCopiedId(card.id);
          setTimeout(() => setCopiedId(null), 3000);
        });
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedId(card.id);
        setTimeout(() => setCopiedId(null), 3000);
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Global modern navigation bar */}
      <header className="bg-white sticky top-0 z-30 shadow-sm shadow-slate-100/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-display font-black text-lg shadow-sm">
              CW
            </div>
            <div>
              <h1 className="text-xl font-display font-black text-slate-900 tracking-tight">Card Wallet</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentView !== 'dashboard' && (
              <button
                onClick={() => {
                  setCurrentView('dashboard');
                  setSelectedCard(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Wallet
              </button>
            )}
            {currentView === 'dashboard' && (
              <button
                onClick={() => {
                  resetForm();
                  setCurrentView('add');
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="Add Loyalty Card"
              >
                <Plus className="w-4 h-4" /> Add Card
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Responsive Body Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col relative">
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: DASHBOARD */}
          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col"
            >


              {/* Cards responsive grid */}
              <div className="flex-1">
                {filteredCards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCards.map((card, index) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          setSelectedCard(card);
                          setIsModalOpen(true);
                        }}
                        className={`relative overflow-hidden ${card.color} rounded-[20px] p-5 text-white shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group`}
                      >
                        {/* Top Card Bar */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-md">
                              {card.isCoupon ? 'Coupon Card' : 'Loyalty Card'}
                            </span>
                            <h3 className="font-display text-lg font-bold mt-2 tracking-tight group-hover:translate-x-1 transition-transform">{card.store}</h3>
                            <p className="text-xs text-white/80 font-medium font-sans">{card.name}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-display font-black text-xs uppercase">
                            {card.store.slice(0, 2)}
                          </div>
                        </div>

                        {/* Dummy mini barcode bar */}
                        <div className="mt-8 flex justify-between items-end border-t border-white/10 pt-3">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-white/60 uppercase font-bold font-sans">Code number</p>
                            <p className="text-sm font-mono tracking-wider font-semibold">{card.cardNumber}</p>
                          </div>
                          {card.expiryDate && (
                            <div className="text-right">
                              <p className="text-[9px] text-white/60 uppercase font-bold font-sans">Expires</p>
                              <p className="text-xs font-semibold bg-red-500/30 px-2 py-0.5 rounded border border-red-400/20">{card.expiryDate}</p>
                            </div>
                          )}
                        </div>

                        {/* Decorative card chip icon */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                          <CreditCard className="w-24 h-24" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-white rounded-3xl border border-slate-150 shadow-sm mt-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                      <CreditCard className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">No cards stored yet</h3>
                    <p className="text-slate-500 text-xs max-w-xs mt-1">
                      Add loyalty cards for your favorite stores, or save templates.
                    </p>
                    <button
                      onClick={() => {
                        resetForm();
                        setCurrentView('add');
                      }}
                      className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Your First Card
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW 2: ADD CARD */}
          {currentView === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 pt-4"
            >
              <div className="max-w-xl mx-auto bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
                <form onSubmit={handleAddCard} className="space-y-4">
                  
                  {/* Card Design Preview placed above Select Theme Design */}
                  <div className="mb-4">
                    <div className={`p-5 rounded-[24px] text-white ${formColor} shadow-md relative overflow-hidden transition-all duration-300`}>
                      <div className="flex justify-between items-start mb-12">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                            {formIsCoupon ? 'Coupon' : 'Loyalty Card'}
                          </span>
                          <h3 className="text-lg font-bold font-display mt-2 h-6 overflow-hidden">
                            {formStoreName || 'New Store'}
                          </h3>
                          <p className="text-xs text-white/80 h-4 overflow-hidden">{formCardName || 'Card Title'}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center font-display font-bold uppercase text-xs">
                          {(formStoreName || 'ST').slice(0, 2)}
                        </div>
                      </div>
                      <div className="flex justify-between items-end pt-2 border-t border-white/10">
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-white/60 uppercase font-bold font-sans">Barcode code</p>
                          <p className="text-sm font-mono tracking-wider h-5 overflow-hidden">{formCardNumber || '•••• •••• ••••'}</p>
                        </div>
                        {formIsCoupon && formExpiryDate && (
                          <div className="text-right">
                            <p className="text-[9px] text-white/60 uppercase font-bold font-sans">Expires</p>
                            <p className="text-xs font-semibold bg-red-500/30 px-2 rounded">{formExpiryDate}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Select Card Color Theme */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Theme Design</label>
                    <div className="grid grid-cols-5 gap-2">
                      {STORE_PRESETS.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setFormColor(p.color)}
                          className={`h-8 rounded-lg cursor-pointer ${p.color} border transition-all ${
                            formColor === p.color 
                              ? 'border-slate-900 ring-2 ring-slate-900/10 scale-105' 
                              : 'border-white/10 opacity-70 hover:opacity-100'
                          }`}
                          title={p.name}
                        />
                      ))}
                    </div>
                  </div>

                    {/* Store Name & Card Label */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Store Name</label>
                        <input
                          type="text"
                          required
                          value={formStoreName}
                          onChange={(e) => setFormStoreName(e.target.value)}
                          placeholder="e.g. Supermarket, Pharmacy"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Card Label</label>
                        <input
                          type="text"
                          required
                          value={formCardName}
                          onChange={(e) => setFormCardName(e.target.value)}
                          placeholder="e.g. Points Card"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Card Number */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Card / Barcode Number</label>
                        <button
                          type="button"
                          onClick={() => setIsScannerOpen(true)}
                          className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Camera className="w-3 h-3" /> Scan Code
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={formCardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        placeholder="Type barcode or card serial number"
                        className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-mono font-bold tracking-widest text-slate-800"
                      />
                    </div>

                    {/* Advanced Barcode Settings Toggle */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedBarcode(!showAdvancedBarcode)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-all cursor-pointer bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-150/60"
                      >
                        <Sliders className="w-3 h-3 text-slate-400" />
                        <span>{showAdvancedBarcode ? 'Hide Advanced Format' : 'Show Advanced Format'}</span>
                        {showAdvancedBarcode ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                      </button>

                      {showAdvancedBarcode && (
                        <div className="space-y-1 mt-2 p-3 bg-slate-50 border border-slate-150/50 rounded-xl animate-fade-in">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Barcode Layout Format</label>
                            <span className="text-[8px] text-indigo-600 font-extrabold bg-indigo-50 px-1 py-0.5 rounded">Auto-detected</span>
                          </div>
                          <select
                            value={formBarcodeType}
                            onChange={(e: any) => setFormBarcodeType(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-700"
                          >
                            {BARCODE_TYPES.map((b) => (
                              <option key={b.value} value={b.value}>{b.label}</option>
                            ))}
                          </select>
                          <p className="text-[9px] text-slate-400 leading-normal font-medium mt-1">
                            The system automatically selects the correct layout standard based on your card number, but you can override it if a specific layout format is required by your store.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expiry and Notes conditional */}
                    <div className="grid grid-cols-1 gap-3">
                      {formIsCoupon && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expiry Date</label>
                          <input
                            type="date"
                            value={formExpiryDate}
                            onChange={(e) => setFormExpiryDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-700"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Special Notes or Checkout Terms</label>
                        <textarea
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          placeholder="e.g. Present at start of scanning"
                          rows={2}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-medium text-slate-600 resize-none"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full mt-4 bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-slate-800 transition-all shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Save Loyalty Card
                    </button>
                  </form>
                </div>
            </motion.div>
          )}



          {/* VIEW 4: EDIT CARD */}
          {currentView === 'edit' && selectedCard && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 pt-4"
            >
              <div className="max-w-xl mx-auto bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
                <form onSubmit={handleUpdateCard} className="space-y-4">
                    
                    {/* Toggle Card / Coupon */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150/60 flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        {formIsCoupon ? (
                          <Ticket className="w-5 h-5 text-rose-500" />
                        ) : (
                          <CreditCard className="w-5 h-5 text-slate-600" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-800">Is this a Coupon Card?</div>
                          <div className="text-[10px] text-slate-500 font-medium">Toggle for custom coupons or discount offers</div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formIsCoupon}
                          onChange={(e) => setFormIsCoupon(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-slate-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                      </label>
                    </div>

                    {/* Store Name & Card Label */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Store Name</label>
                        <input
                          type="text"
                          required
                          value={formStoreName}
                          onChange={(e) => setFormStoreName(e.target.value)}
                          placeholder="e.g. Supermarket, Pharmacy"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Card Label</label>
                        <input
                          type="text"
                          required
                          value={formCardName}
                          onChange={(e) => setFormCardName(e.target.value)}
                          placeholder="e.g. Points Card"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Card Number */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Card / Barcode Number</label>
                        <button
                          type="button"
                          onClick={() => setIsScannerOpen(true)}
                          className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Camera className="w-3 h-3" /> Scan Code
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={formCardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        placeholder="Type barcode or card serial number"
                        className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-mono font-bold tracking-widest text-slate-800"
                      />
                    </div>

                    {/* Advanced Barcode Settings Toggle */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedBarcode(!showAdvancedBarcode)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-all cursor-pointer bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-150/60"
                      >
                        <Sliders className="w-3 h-3 text-slate-400" />
                        <span>{showAdvancedBarcode ? 'Hide Advanced Format' : 'Show Advanced Format'}</span>
                        {showAdvancedBarcode ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                      </button>

                      {showAdvancedBarcode && (
                        <div className="space-y-1 mt-2 p-3 bg-slate-50 border border-slate-150/50 rounded-xl animate-fade-in">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Barcode Layout Format</label>
                            <span className="text-[8px] text-indigo-600 font-extrabold bg-indigo-50 px-1 py-0.5 rounded">Auto-detected</span>
                          </div>
                          <select
                            value={formBarcodeType}
                            onChange={(e: any) => setFormBarcodeType(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-700"
                          >
                            {BARCODE_TYPES.map((b) => (
                              <option key={b.value} value={b.value}>{b.label}</option>
                            ))}
                          </select>
                          <p className="text-[9px] text-slate-400 leading-normal font-medium mt-1">
                            The system automatically selects the correct layout standard based on your card number, but you can override it if a specific layout format is required by your store.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expiry and Notes conditional */}
                    <div className="grid grid-cols-1 gap-3">
                      {formIsCoupon && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expiry Date</label>
                          <input
                            type="date"
                            value={formExpiryDate}
                            onChange={(e) => setFormExpiryDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-semibold text-slate-700"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Special Notes or Checkout Terms</label>
                        <textarea
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          placeholder="e.g. Present at start of scanning"
                          rows={2}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none shadow-sm font-medium text-slate-600 resize-none"
                        />
                      </div>
                    </div>

                    {/* Card Design Preview placed above Select Theme Design */}
                    <div className="mb-4">
                      <div className={`p-5 rounded-[24px] text-white ${formColor} shadow-md relative overflow-hidden transition-all duration-300`}>
                        <div className="flex justify-between items-start mb-12">
                          <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                              {formIsCoupon ? 'Coupon' : 'Loyalty Card'}
                            </span>
                            <h3 className="text-lg font-bold font-display mt-2 h-6 overflow-hidden">
                              {formStoreName || 'New Store'}
                            </h3>
                            <p className="text-xs text-white/80 h-4 overflow-hidden">{formCardName || 'Card Title'}</p>
                          </div>
                          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center font-display font-bold uppercase text-xs">
                            {(formStoreName || 'ST').slice(0, 2)}
                          </div>
                        </div>
                        <div className="flex justify-between items-end pt-2 border-t border-white/10">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-white/60 uppercase font-bold font-sans">Barcode code</p>
                            <p className="text-sm font-mono tracking-wider h-5 overflow-hidden">{formCardNumber || '•••• •••• ••••'}</p>
                          </div>
                          {formIsCoupon && formExpiryDate && (
                            <div className="text-right">
                              <p className="text-[9px] text-white/60 uppercase font-bold font-sans">Expires</p>
                              <p className="text-xs font-semibold bg-red-500/30 px-2 rounded">{formExpiryDate}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Color Grid selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Theme Design</label>
                      <div className="grid grid-cols-5 gap-2">
                        {STORE_PRESETS.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setFormColor(p.color)}
                            className={`h-8 rounded-lg cursor-pointer ${p.color} border transition-all ${
                              formColor === p.color 
                                ? 'border-slate-900 ring-2 ring-slate-900/10 scale-105' 
                                : 'border-white/10 opacity-70 hover:opacity-100'
                            }`}
                            title={p.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full mt-4 bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-slate-800 transition-all shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Save Modifications
                    </button>
                  </form>
                </div>
            </motion.div>
          )}

          {/* VIEW 5: IMPORT SHARED CARD FROM SQLITE */}
          {currentView === 'share' && (
            <motion.div
              key="share"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-sm space-y-5"
            >
              <div className="text-center space-y-1.5">
                <div className="inline-flex p-3 rounded-full bg-slate-100 border border-slate-200 text-slate-600 mb-2">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black font-display text-slate-900">Incoming Shared Card</h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Someone has shared a loyalty or discount card with you.
                </p>
              </div>

              {isFetchingShared ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-800 animate-spin"></div>
                  <span className="text-xs font-semibold text-slate-400 font-sans">Retrieving shared card...</span>
                </div>
              ) : sharedError ? (
                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 text-center space-y-3">
                  <p className="text-xs font-semibold text-rose-600">{sharedError}</p>
                  <p className="text-[10px] text-neutral-400 font-medium">The link may have expired or the key is incorrect.</p>
                  <button
                    onClick={() => {
                      window.history.pushState({}, '', '/');
                      setCurrentView('dashboard');
                    }}
                    className="w-full bg-slate-900 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Go to My Wallet
                  </button>
                </div>
              ) : sharedCard ? (
                <div className="space-y-4">
                  {/* Card Preview */}
                  <div className={`p-5 rounded-[24px] text-white ${sharedCard.color} shadow-sm relative overflow-hidden`}>
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                          {sharedCard.isCoupon ? 'Coupon Offer' : 'Loyalty Code'}
                        </span>
                        <h2 className="text-xl font-bold font-display mt-2">{sharedCard.store}</h2>
                        <p className="text-xs text-white/80 font-sans">{sharedCard.name}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center font-display font-bold text-lg">
                        {sharedCard.store.slice(0, 2)}
                      </div>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-3">
                      <div>
                        <p className="text-[9px] text-white/50 uppercase font-bold font-sans">Serial code</p>
                        <p className="text-sm font-mono tracking-wider font-semibold">{sharedCard.cardNumber}</p>
                      </div>
                      {sharedCard.expiryDate && (
                        <div className="text-right">
                          <p className="text-[9px] text-white/50 uppercase font-bold font-sans">Expires</p>
                          <p className="text-xs font-semibold bg-rose-500/30 px-2 rounded-lg">{sharedCard.expiryDate}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shared Barcode Preview */}
                  <div className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">Scannable Target</label>
                    <BarcodeRenderer value={sharedCard.cardNumber} type={sharedCard.barcodeType} />
                  </div>

                  {/* Terms / Notes */}
                  {sharedCard.notes && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 uppercase font-sans tracking-wider block mb-1">Notes / Description</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{sharedCard.notes}</p>
                    </div>
                  )}

                  {/* Import Button */}
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={handleImportSharedCard}
                      className="w-full bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-slate-800 transition-all shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      📥 Add this Card to My Wallet
                    </button>
                    
                    <button
                      onClick={() => {
                        window.history.pushState({}, '', '/');
                        setCurrentView('dashboard');
                        setSharedCard(null);
                      }}
                      className="w-full bg-slate-100 text-slate-600 font-bold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition-all text-xs cursor-pointer"
                    >
                      Cancel & View Wallet
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Camera Barcode / QR Scanner overlay */}
      {isScannerOpen && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Modern Card View Modal overlay */}
      <AnimatePresence>
        {isModalOpen && selectedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with fade effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Content with spring transition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative text-white ${selectedCard.color} rounded-[28px] max-w-md w-full overflow-hidden shadow-2xl z-10 border border-white/10 p-6 flex flex-col space-y-6`}
            >
              {/* Header with store info */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold font-display tracking-tight">{selectedCard.store}</h2>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-display font-bold text-lg">
                  {selectedCard.store.slice(0, 2)}
                </div>
              </div>

              {/* Big Live Barcode / QR rendering block */}
              <div className="w-full py-6 bg-white rounded-2xl flex justify-center items-center shadow-inner">
                <BarcodeRenderer value={selectedCard.cardNumber} type={selectedCard.barcodeType} />
              </div>

              {/* Expiry Date Row */}
              {selectedCard.expiryDate && (
                <div className="flex justify-between items-center border-t border-white/15 pt-4">
                  <span className="text-xs text-white/60 uppercase font-bold tracking-wider font-sans">Expires</span>
                  <span className="text-sm font-semibold bg-rose-500/30 border border-rose-500/20 px-3 py-1 rounded-full">{selectedCard.expiryDate}</span>
                </div>
              )}

              {/* Actions & Close Row */}
              <div className="flex justify-between items-center border-t border-white/15 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadCardForEdit(selectedCard)}
                    className="p-2 px-4 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white transition-all shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Edit Card"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCard(selectedCard.id)}
                    className="p-2 px-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-100 hover:bg-rose-500/30 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Delete Card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
                
                {/* Close Button */}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 px-4 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white/90 hover:text-white transition-all shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
