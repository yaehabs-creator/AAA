
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase/config';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { analyzeContract } from './services/geminiService';
import { saveContractToDB, getAllContracts, deleteContractFromDB } from './services/dbService';
import { login, logout, getUserRole, getCurrentUser } from './services/authService';
import { loadClauses, saveClause, deleteClause, loadContracts, createContract, subscribeToClauses } from './services/firestoreService';
import { migrateIndexedDBToFirestore, isMigrationNeeded } from './services/migrationService';
import { Clause, AnalysisStatus, SavedContract, ConditionType, FileData, DualSourceInput, UserRole } from './types';
import { ClauseCard } from './components/ClauseCard';
import { Dashboard } from './components/Dashboard';
import { Sidebar } from './components/Sidebar';
import { ComparisonModal } from './components/ComparisonModal';
import { AddClauseModal } from './components/AddClauseModal';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { PendingApproval } from './components/PendingApproval';
import { UserManagement } from './components/UserManagement';

const REASSURING_STAGES = [
  { progress: 10, label: "Scanning Pages...", sub: "Mapping document layers" },
  { progress: 30, label: "Verbatim Extraction...", sub: "Processing batch sequences" },
  { progress: 60, label: "Validating Text Integrity...", sub: "Neural word-for-word check" },
  { progress: 90, label: "Finalizing Records...", sub: "Syncing temporal ledger" }
];

const TEXT_STAGES = [
  { progress: 20, label: "Direct Injection...", sub: "Bypassing extraction layers" },
  { progress: 50, label: "Rapid Neural Mapping...", sub: "Analyzing verbatim strings" },
  { progress: 85, label: "Validating Ledger...", sub: "Confirming condition types" },
  { progress: 100, label: "Ready", sub: "Finalizing" }
];

const linkifyText = (text: string | undefined): string => {
  if (!text) return "";
  const pattern = /(?<!href=["']#clause-)(?:[Cc]lause|[Ss]ub-clause|[Aa]rticle|[Pp]aragraph|[Ss]ub-paragraph)\s+(\d+(?:\.\d+)*(?:\s*\([a-z0-9]\))?)/gi;
  return text.replace(pattern, (match, number) => {
    const cleanId = number.replace(/\s+/g, '').replace(/[()]/g, '');
    return `<a href="#clause-${cleanId}">${match}</a>`;
  });
};

interface SearchResult {
  clause_id: string;
  clause_number: string;
  title: string;
  condition_type: string;
  relevance_score: number;
  reason: string;
}

type AuthView = 'login' | 'signup' | 'app';

const App: React.FC = () => {
  // Auth State
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [availableContracts, setAvailableContracts] = useState<Array<{ id: string; meta: any }>>([]);

  // App State
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeStage, setActiveStage] = useState(REASSURING_STAGES[0]);
  const [batchInfo, setBatchInfo] = useState({ current: 0, total: 0 });
  
  const [generalFile, setGeneralFile] = useState<FileData | null>(null);
  const [particularFile, setParticularFile] = useState<FileData | null>(null);
  const [pastedGeneralText, setPastedGeneralText] = useState('');
  const [pastedParticularText, setPastedParticularText] = useState('');
  const [inputMode, setInputMode] = useState<'single' | 'dual' | 'text'>('dual');

  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<ConditionType[]>(['General', 'Particular']);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [compareClause, setCompareClause] = useState<Clause | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [library, setLibrary] = useState<SavedContract[]>([]);
  const [projectName, setProjectName] = useState('');
  const [activeContractId, setActiveContractId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(false);

  // Smart Search States
  const [smartSearchQuery, setSmartSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileRef = useRef<HTMLInputElement>(null);
  const particularFileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stages = inputMode === 'text' ? TEXT_STAGES : REASSURING_STAGES;
    const stage = [...stages].reverse().find(s => progress >= s.progress) || stages[0];
    setActiveStage(stage);
  }, [progress, inputMode]);

  const refreshLibrary = async () => {
    try {
      const contracts = await getAllContracts();
      setLibrary(contracts || []);
    } catch (err) {
      console.error("Library load failed:", err);
      setLibrary([]);
    }
  };

  // Auth State Management
  useEffect(() => {
    let isMounted = true;
    
    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;
        
        setIsLoadingAuth(true);
        try {
          if (user) {
            console.log('User authenticated:', user.email);
            let profile = await getUserRole(user.uid);
            
            // If profile doesn't exist, create it (for users who signed up before profile creation was implemented)
            if (!profile) {
              console.log('Profile not found, creating one...');
              try {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const isFirstUser = usersSnapshot.empty;
                
                await setDoc(doc(db, 'users', user.uid), {
                  email: user.email || '',
                  role: isFirstUser ? 'admin' : 'pending',
                  createdAt: serverTimestamp()
                });
                
                // Reload profile
                profile = await getUserRole(user.uid);
                console.log('Profile created with role:', profile?.role);
              } catch (err) {
                console.error('Error creating user profile:', err);
              }
            }
            
            if (profile) {
              console.log('User role:', profile.role);
              if (!isMounted) return;
              setUserRole(profile.role);
              setIsAuthenticated(true);
              
              // Check if migration is needed (only for admin)
              if (profile.role === 'admin' && isMigrationNeeded()) {
                try {
                  await migrateIndexedDBToFirestore((progress) => {
                    console.log(`Migration: ${progress.current}/${progress.total} - ${progress.contractName}`);
                  });
                } catch (err) {
                  console.error('Migration failed:', err);
                }
              }
              
              // Load contracts
              try {
                const contracts = await loadContracts();
                if (!isMounted) return;
                setAvailableContracts(contracts);
                
                // Set default contract
                if (contracts.length > 0) {
                  const defaultContract = contracts.find(c => c.id === 'HassanAllam') || contracts[0];
                  setIsInitialLoad(true);
                  setActiveContractId(defaultContract.id);
                  setProjectName(defaultContract.meta.title);
                  
                  // Load clauses for default contract
                  const loadedClauses = await loadClauses(defaultContract.id);
                  if (!isMounted) return;
                  setClauses(loadedClauses);
                  // If admin, show completed status (dashboard with clauses)
                  // If non-admin, show IDLE status (contracts list) unless they have clauses
                  if (profile.role === 'admin' || loadedClauses.length > 0) {
                    setStatus(AnalysisStatus.COMPLETED);
                  } else {
                    setStatus(AnalysisStatus.IDLE);
                  }
                  // Allow subscription to take over after initial load
                  setTimeout(() => setIsInitialLoad(false), 1000);
                } else {
                  // No contracts available - show IDLE (contracts list for non-admin, upload for admin)
                  setStatus(AnalysisStatus.IDLE);
                }
              } catch (err) {
                console.error('Error loading contracts:', err);
              }
            } else {
              console.error('Failed to create or retrieve user profile');
              if (!isMounted) return;
              setIsAuthenticated(false);
              setUserRole(null);
            }
          } else {
            console.log('No user authenticated');
            if (!isMounted) return;
            setIsAuthenticated(false);
            setUserRole(null);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          if (!isMounted) return;
          setIsAuthenticated(false);
          setUserRole(null);
        } finally {
          if (isMounted) {
            setIsLoadingAuth(false);
          }
        }
      }, (error) => {
        console.error('Auth state listener error:', error);
        if (isMounted) {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
      });

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (error) {
      console.error('Failed to set up auth listener:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    }
  }, []);

  // Real-time clause updates
  useEffect(() => {
    if (activeContractId && isAuthenticated) {
      console.log('Setting up clause subscription for contract:', activeContractId);
      const unsubscribe = subscribeToClauses(activeContractId, (updatedClauses) => {
        console.log('Clauses updated from subscription:', updatedClauses.length);
        // Only update if not in initial load phase, or if we have clauses (to avoid clearing during initial load)
        if (!isInitialLoad || updatedClauses.length > 0) {
          setClauses(updatedClauses);
        } else {
          console.log('Skipping subscription update during initial load');
        }
      });
      return () => {
        console.log('Cleaning up clause subscription');
        unsubscribe();
      };
    } else {
      // Clear clauses when no contract is selected or user is not authenticated
      if (!activeContractId || !isAuthenticated) {
        console.log('Clearing clauses - no active contract or not authenticated');
        setClauses([]);
        setIsInitialLoad(false);
      }
    }
  }, [activeContractId, isAuthenticated, isInitialLoad]);

  useEffect(() => { refreshLibrary(); }, []);

  const persistCurrentProject = async (newClauses?: Clause[], newName?: string) => {
    const targetClauses = newClauses || clauses;
    const targetName = (newName || projectName).trim() || "Untitled Project";
    const targetId = activeContractId || crypto.randomUUID();
    if (targetClauses.length === 0) return;
    setIsSaving(true);
    try {
      const saved: SavedContract = {
        id: targetId,
        name: targetName,
        timestamp: Date.now(),
        clauses: targetClauses,
        metadata: {
          totalClauses: targetClauses.length,
          generalCount: targetClauses.filter(c => c.condition_type === 'General').length,
          particularCount: targetClauses.filter(c => c.condition_type === 'Particular').length,
          highRiskCount: 0,
          conflictCount: targetClauses.filter(c => c.comparison && c.comparison.length > 0).length,
          timeSensitiveCount: targetClauses.filter(c => c.time_frames && c.time_frames.length > 0).length
        }
      };
      await saveContractToDB(saved);
      if (!activeContractId) setActiveContractId(targetId);
      await refreshLibrary();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  const handleUpdateClause = async (updatedClause: Clause) => {
    if (!activeContractId) return;
    
    try {
      await saveClause(activeContractId, updatedClause);
      if (compareClause && compareClause.clause_number === updatedClause.clause_number) {
        setCompareClause(updatedClause);
      }
    } catch (err) {
      console.error('Error updating clause:', err);
      setError('Failed to update clause');
    }
  };

  const smartSearchClauses = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const searchContext = clauses.map(c => ({
      clause_id: `C.${c.clause_number}`,
      clause_number: c.clause_number,
      title: c.clause_title,
      text: c.clause_text.substring(0, 500),
      condition_type: c.condition_type
    }));

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [{
            text: `USER QUERY: "${query}"\n\nCLAUSE DATA:\n${JSON.stringify(searchContext)}`
          }]
        }],
        config: {
          systemInstruction: `You are the Smart Search Engine for AAA Contract Department.
You receive a natural-language query and a list of clauses.
Your job is to select and rank the top 5 clauses that best match the query by meaning and keywords.
Focus on construction contract concepts: time frames, payment, insurance, liability, termination, etc.
Return ONLY JSON. Do not add any extra text.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    clause_id: { type: Type.STRING },
                    clause_number: { type: Type.STRING },
                    title: { type: Type.STRING },
                    condition_type: { type: Type.STRING },
                    relevance_score: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      setSearchResults(result.results);
    } catch (err) {
      console.error("Smart Search Error:", err);
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const onOpenClause = (clauseNumber: string) => {
    const clause = clauses.find(c => c.clause_number === clauseNumber);
    if (clause) {
      setCompareClause(clause);
    }
  };

  const handleSaveManualClause = async (data: {
    number: string;
    title: string;
    generalText: string;
    particularText: string;
    contractId: string;
  }) => {
    if (!activeContractId) return;
    
    const conditionType: ConditionType = data.particularText.trim() ? 'Particular' : 'General';
    const newClause: Clause = {
      clause_number: data.number,
      clause_title: data.title || "Untitled Clause",
      clause_text: linkifyText(data.particularText || data.generalText),
      condition_type: conditionType,
      general_condition: data.generalText.trim() ? linkifyText(data.generalText) : undefined,
      particular_condition: data.particularText.trim() ? linkifyText(data.particularText) : undefined,
      comparison: [],
      time_frames: []
    };
    
    try {
      await saveClause(activeContractId, newClause);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Error saving clause:', err);
      setError('Failed to save clause');
    }
  };

  const handleContractChange = async (contractId: string) => {
    setIsInitialLoad(true);
    setActiveContractId(contractId);
    try {
      const contract = availableContracts.find(c => c.id === contractId);
      if (contract) {
        setProjectName(contract.meta.title);
        let loadedClauses = await loadClauses(contractId);
        
        // If no clauses in Firestore, check IndexedDB and migrate
        if (loadedClauses.length === 0 && userRole === 'admin') {
          console.log('No clauses in Firestore, checking IndexedDB...');
          const indexedContracts = await getAllContracts();
          const indexedContract = indexedContracts.find(c => {
            const cId = c.id?.replace(/[^a-zA-Z0-9]/g, '') || c.name.replace(/[^a-zA-Z0-9]/g, '');
            return cId === contractId || c.name === contract.meta.title;
          });
          
          if (indexedContract && indexedContract.clauses.length > 0) {
            console.log(`Found ${indexedContract.clauses.length} clauses in IndexedDB, migrating...`);
            // Migrate clauses from IndexedDB
            for (const clause of indexedContract.clauses) {
              try {
                await saveClause(contractId, clause);
              } catch (err) {
                console.error(`Error migrating clause ${clause.clause_number}:`, err);
              }
            }
            // Reload clauses
            loadedClauses = await loadClauses(contractId);
            console.log(`Migrated ${loadedClauses.length} clauses to Firestore`);
          }
        }
        
        setClauses(loadedClauses);
        setStatus(AnalysisStatus.COMPLETED);
        // Allow subscription to take over after initial load
        setTimeout(() => setIsInitialLoad(false), 1000);
      }
    } catch (err) {
      console.error('Error loading contract:', err);
      setIsInitialLoad(false);
      setError('Failed to load contract');
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setUserRole(null);
    setAuthView('login');
    setClauses([]);
    setActiveContractId(null);
    setIsInitialLoad(false);
    setAvailableContracts([]);
  };

  const handleRenameArchive = async (e: React.MouseEvent, contract: SavedContract) => {
    e.stopPropagation();
    const newName = prompt("Enter new project name:", contract.name);
    if (newName && newName.trim() !== "" && newName !== contract.name) {
      const updated = { ...contract, name: newName.trim() };
      await saveContractToDB(updated);
      await refreshLibrary();
      if (activeContractId === contract.id) setProjectName(updated.name);
    }
  };

  const handleDeleteArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Permanently delete this project from archive?")) {
      await deleteContractFromDB(id);
      await refreshLibrary();
      if (activeContractId === id) {
        setStatus(AnalysisStatus.IDLE);
        setActiveContractId(null);
        setClauses([]);
      }
    }
  };

  const handleExportContract = (e: React.MouseEvent, contract: SavedContract) => {
    e.stopPropagation();
    const dataStr = JSON.stringify(contract, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = `${contract.name.replace(/[^a-z0-9]/gi, '_')}_Backup_${new Date().toISOString().slice(0,10)}.json`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportContract = async (file: File) => {
    setError(null);
    setStatus(AnalysisStatus.ANALYZING);
    setProgress(0);
    
    try {
      console.log('Starting import of file:', file.name);
      const text = await file.text();
      console.log('File read, parsing JSON...');
      const contract: SavedContract = JSON.parse(text);
      
      // Validate the contract structure
      if (!contract.name) {
        throw new Error("Invalid contract file format. Missing 'name' field.");
      }
      if (!contract.clauses || !Array.isArray(contract.clauses)) {
        throw new Error("Invalid contract file format. Missing or invalid 'clauses' array.");
      }
      if (contract.clauses.length === 0) {
        throw new Error("Contract file contains no clauses.");
      }

      console.log(`Importing contract: ${contract.name} with ${contract.clauses.length} clauses`);

      // Use the contract ID from the file, or generate a sanitized one
      const contractId = (contract.id || contract.name).replace(/[^a-zA-Z0-9]/g, '') || `contract-${Date.now()}`;
      console.log('Contract ID:', contractId);
      
      setProgress(10);
      
      // Create contract metadata in Firestore
      try {
        await createContract(contractId, contract.name);
        console.log('Contract metadata created');
      } catch (err: any) {
        // Contract might already exist, that's okay
        if (!err.message?.includes('already exists')) {
          console.warn('Contract might already exist, continuing...');
        }
      }
      
      setProgress(20);
      
      // Save all clauses to Firestore
      let successCount = 0;
      const totalClauses = contract.clauses.length;
      
      for (let i = 0; i < contract.clauses.length; i++) {
        const clause = contract.clauses[i];
        try {
          await saveClause(contractId, clause);
          successCount++;
          setProgress(20 + Math.floor((i + 1) / totalClauses * 70));
        } catch (err) {
          console.error(`Error importing clause ${clause.clause_number}:`, err);
        }
      }
      
      console.log(`Imported ${successCount}/${totalClauses} clauses`);
      setProgress(90);
      
      // Refresh contracts list
      const contracts = await loadContracts();
      setAvailableContracts(contracts);
      
      // Load the imported contract
      const loadedClauses = await loadClauses(contractId);
      console.log(`Loaded ${loadedClauses.length} clauses from Firestore`);
      
      setClauses(loadedClauses);
      setProjectName(contract.name);
      setActiveContractId(contractId);
      setProgress(100);
      setStatus(AnalysisStatus.COMPLETED);
      
      alert(`Contract "${contract.name}" imported successfully!\n${loadedClauses.length} clauses loaded.`);
    } catch (err: any) {
      console.error("Import failed:", err);
      setError(err.message || "Failed to import contract. Please check the file format.");
      setStatus(AnalysisStatus.ERROR);
      alert(`Failed to import contract: ${err.message || "Invalid file format"}\n\nCheck the browser console for details.`);
    }
  };

  const handleDeleteClause = async (clauseNumber: string) => {
    if (!activeContractId) return;
    if (!confirm("Permanently remove this clause node?")) return;
    
    try {
      const clauseId = `C.${clauseNumber.replace(/[^0-9.]/g, '')}`;
      await deleteClause(activeContractId, clauseId);
    } catch (err) {
      console.error('Error deleting clause:', err);
      setError('Failed to delete clause');
    }
  };

  const extractPagesFromPdf = async (fileData: FileData): Promise<string[]> => {
    const loadingTask = (window as any).pdfjsLib.getDocument({ data: atob(fileData.data) });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items.sort((a: any, b: any) => {
        if (Math.abs(b.transform[5] - a.transform[5]) > 5) return b.transform[5] - a.transform[5];
        return a.transform[4] - b.transform[4];
      });
      let lastY = -1;
      let pageText = `--- PAGE ${i} ---\n`;
      for (const item of items) {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) pageText += "\n";
        pageText += item.str + " ";
        lastY = item.transform[5];
      }
      pages.push(pageText);
    }
    return pages;
  };

  const handleTextAnalysis = async (general: string, particular: string) => {
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    setProgress(15);
    setBatchInfo({ current: 1, total: 1 });
    try {
      const input: DualSourceInput = { general, particular };
      const result = await analyzeContract(input);
      setProgress(100);
      finalizeAnalysis(result);
    } catch (err: any) {
      setError(err.message);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handlePdfAnalysis = async (input: FileData | DualSourceInput) => {
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    setProgress(5);
    let allExtractedClauses: Clause[] = [];
    try {
      if ('data' in input) {
        const pages = await extractPagesFromPdf(input as FileData);
        setBatchInfo({ current: 0, total: pages.length });
        for (let i = 0; i < pages.length; i++) {
          setBatchInfo({ current: i + 1, total: pages.length });
          const result = await analyzeContract(pages[i]);
          allExtractedClauses = [...allExtractedClauses, ...result];
          setProgress(Math.floor(((i + 1) / pages.length) * 100));
        }
      } else {
        const gPages = await extractPagesFromPdf(input.general as FileData);
        const pPages = await extractPagesFromPdf(input.particular as FileData);
        const maxPages = Math.max(gPages.length, pPages.length);
        setBatchInfo({ current: 0, total: Math.ceil(maxPages / 2) });
        for (let b = 0; b < Math.ceil(maxPages / 2); b++) {
          setBatchInfo({ current: b + 1, total: Math.ceil(maxPages / 2) });
          const gChunk = gPages.slice(b * 2, (b + 1) * 2).join("\n\n");
          const pChunk = pPages.slice(b * 2, (b + 1) * 2).join("\n\n");
          const result = await analyzeContract({ general: gChunk, particular: pChunk });
          allExtractedClauses = [...allExtractedClauses, ...result];
          setProgress(Math.floor(((b + 1) / Math.ceil(maxPages / 2)) * 100));
        }
      }
      finalizeAnalysis(allExtractedClauses);
    } catch (err: any) {
      setError(err.message);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const finalizeAnalysis = async (allExtractedClauses: Clause[]) => {
    const processedClauses = allExtractedClauses.map(c => ({
      ...c,
      clause_text: linkifyText(c.clause_text),
      general_condition: linkifyText(c.general_condition),
      particular_condition: linkifyText(c.particular_condition)
    }));
    const sorted = processedClauses.sort((a, b) => {
      const parse = (s: string) => s.split('.').map(x => parseInt(x) || 0);
      const aP = parse(a.clause_number);
      const bP = parse(b.clause_number);
      for(let i=0; i<Math.max(aP.length, bP.length); i++) {
        if ((aP[i] || 0) !== (bP[i] || 0)) return (aP[i] || 0) - (bP[i] || 0);
      }
      return 0;
    });
    
    const first = sorted.find(c => c.clause_title && c.clause_title !== 'Untitled');
    const detectedName = first?.clause_title || `Analysis ${new Date().toLocaleDateString()}`;
    const contractId = detectedName.replace(/[^a-zA-Z0-9]/g, '') || `contract-${Date.now()}`;
    
    try {
      // Create contract if it doesn't exist
      await createContract(contractId, detectedName);
      
      // Save all clauses
      for (const clause of sorted) {
        await saveClause(contractId, clause);
      }
      
      setClauses(sorted);
      setProjectName(detectedName);
      setActiveContractId(contractId);
      
      // Refresh contracts list
      const contracts = await loadContracts();
      setAvailableContracts(contracts);
      
      setProgress(100);
      setTimeout(() => setStatus(AnalysisStatus.COMPLETED), 600);
    } catch (err) {
      console.error('Error finalizing analysis:', err);
      setError('Failed to save contract');
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const processFile = (file: File, callback: (fd: FileData) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        callback({ data: result.split(',')[1], mimeType: file.type, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    // Reordering is handled by Firestore, this is just for UI
    const newClauses = [...clauses];
    const [movedItem] = newClauses.splice(fromIndex, 1);
    newClauses.splice(toIndex, 0, movedItem);
    setClauses(newClauses);
  };

  const filteredClauses = clauses.filter(c => {
    const matchesSearch = searchFilter === '' || 
      c.clause_number.toLowerCase().includes(searchFilter.toLowerCase()) || 
      c.clause_text.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.clause_title.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesType = selectedTypes.includes(c.condition_type);
    const matchesGroup = !selectedGroup || (selectedGroup === 'Other' && !/^\d+/.test(String(c.clause_number))) || String(c.clause_number).startsWith(selectedGroup);
    return matchesSearch && matchesType && matchesGroup;
  });

  const goBackToInput = () => {
    setStatus(AnalysisStatus.IDLE);
    setClauses([]);
    setActiveContractId(null);
  };

  // Timeout for loading state (in case Firebase fails to initialize)
  useEffect(() => {
    if (isLoadingAuth) {
      const timeout = setTimeout(() => {
        console.warn('Auth loading timeout - forcing login screen');
        setIsLoadingAuth(false);
      }, 5000); // 5 second timeout
      return () => clearTimeout(timeout);
    }
  }, [isLoadingAuth]);

  // Show loading screen while checking auth
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-aaa-blue rounded-xl flex items-center justify-center shadow-xl mx-auto mb-4">
            <span className="text-white font-black text-xl">AAA</span>
          </div>
          <p className="text-aaa-muted text-sm font-bold uppercase tracking-widest mb-4">Loading...</p>
          <p className="text-aaa-muted text-xs mb-4">If this takes too long, check the browser console for errors</p>
          <button
            onClick={() => {
              console.log('Force skip loading');
              setIsLoadingAuth(false);
            }}
            className="text-xs text-aaa-blue hover:underline"
          >
            Skip loading (debug)
          </button>
        </div>
      </div>
    );
  }

  // Show auth screens if not authenticated
  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <Signup onSwitchToLogin={() => setAuthView('login')} onSignupSuccess={() => {}} />;
    }
    return <Login onSwitchToSignup={() => setAuthView('signup')} onLoginSuccess={() => {}} />;
  }

  // Show pending approval if role is pending
  if (userRole === 'pending') {
    return <PendingApproval onLogout={handleLogout} />;
  }

  const canEdit = userRole === 'admin' || userRole === 'editor';
  const canDelete = userRole === 'admin';
  const canUpload = userRole === 'admin';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-aaa-border shadow-premium px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-5 cursor-pointer" onClick={goBackToInput}>
          <div className="w-12 h-12 bg-aaa-blue rounded-xl flex items-center justify-center shadow-xl">
            <span className="text-white font-black text-sm">AAA</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-aaa-blue tracking-tighter leading-none">Contract Department</h1>
            <p className="text-[10px] font-bold text-aaa-muted uppercase tracking-[0.3em] mt-1.5">High-Fidelity Analysis</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Contract Selector */}
          {availableContracts.length > 0 && (
            <select
              value={activeContractId || ''}
              onChange={(e) => handleContractChange(e.target.value)}
              className="px-4 py-2 bg-white border border-aaa-border rounded-xl text-sm font-bold text-aaa-blue focus:ring-4 focus:ring-aaa-blue/5 focus:border-aaa-blue outline-none"
            >
              {availableContracts.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.meta.title}
                </option>
              ))}
            </select>
          )}

          {/* User Management (Admin Only) */}
          {userRole === 'admin' && (
            <button
              onClick={() => setShowUserManagement(!showUserManagement)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-aaa-border rounded-xl shadow-sm hover:shadow-md transition-all text-[10px] font-black uppercase tracking-widest text-aaa-muted hover:text-aaa-blue"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Users
            </button>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-aaa-border rounded-xl shadow-sm hover:shadow-md transition-all text-[10px] font-black uppercase tracking-widest text-aaa-muted hover:text-red-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>

          {status === AnalysisStatus.IDLE && canUpload && (
            <button 
              onClick={() => importFileRef.current?.click()} 
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Backup
            </button>
          )}
          {status === AnalysisStatus.COMPLETED && (
            <div className="flex items-center gap-6">
              <div className="relative group flex items-center">
                <input 
                  type="text" 
                  value={smartSearchQuery}
                  onChange={(e) => setSmartSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && smartSearchClauses(smartSearchQuery)}
                  placeholder="Smart search matrix..."
                  className="w-80 px-6 py-2.5 bg-white border border-aaa-border rounded-full text-sm font-medium focus:ring-4 focus:ring-aaa-blue/5 focus:border-aaa-blue outline-none shadow-sm transition-all"
                />
                <button 
                  onClick={() => smartSearchClauses(smartSearchQuery)}
                  disabled={isSearching}
                  className="absolute right-2 p-2 bg-aaa-blue text-white rounded-full hover:bg-aaa-hover transition-colors disabled:bg-aaa-muted"
                >
                  {isSearching ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {canEdit && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-3 px-6 py-2.5 bg-aaa-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-aaa-hover transition-all shadow-lg active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  + Add Clause
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* User Management Modal */}
      {showUserManagement && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-premium border border-aaa-border p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-aaa-blue tracking-tighter">User Management</h2>
              <button
                onClick={() => setShowUserManagement(false)}
                className="text-aaa-muted hover:text-aaa-blue transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <UserManagement onClose={() => setShowUserManagement(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {status === AnalysisStatus.COMPLETED && (
          <Sidebar 
            clauses={clauses}
            selectedTypes={selectedTypes}
            setSelectedTypes={setSelectedTypes}
            selectedGroup={selectedGroup}
            setSelectedGroup={setSelectedGroup}
            searchQuery={searchFilter}
            setSearchQuery={setSearchFilter}
            onReorder={handleReorder}
            onDelete={handleDeleteClause}
          />
        )}

        <main className={`flex-1 overflow-y-auto px-10 py-12 custom-scrollbar ${status !== AnalysisStatus.COMPLETED ? 'max-w-7xl mx-auto' : ''}`}>
          {status === AnalysisStatus.IDLE && userRole === 'admin' && (
            <div className="space-y-16 animate-in fade-in duration-1000">
               <div className="text-center space-y-6">
                <div className="inline-flex items-center gap-3 px-5 py-2 bg-white border border-aaa-blue/10 text-aaa-blue text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud Neural Engine Active
                </div>
                <h2 className="text-7xl font-black text-aaa-blue leading-[1.05] tracking-tighter">
                  Verbatim <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-aaa-blue to-aaa-accent">Precision Extraction.</span>
                </h2>
                <p className="text-aaa-muted text-xl max-w-2xl mx-auto leading-relaxed font-medium">
                  Direct text injection or multi-page PDF processing. Mapping temporal records and baseline conflicts in high-fidelity verbatim sequences.
                </p>
              </div>

              <div className="flex flex-col items-center gap-8">
                <div className="flex bg-white border border-aaa-border p-1.5 rounded-2xl shadow-premium">
                  <button onClick={() => setInputMode('dual')} className={`px-10 py-3 rounded-xl text-xs font-black transition-all ${inputMode === 'dual' ? 'bg-aaa-blue text-white shadow-xl' : 'text-aaa-muted hover:text-aaa-blue'}`}>Dual Source PDF</button>
                  <button onClick={() => setInputMode('single')} className={`px-10 py-3 rounded-xl text-xs font-black transition-all ${inputMode === 'single' ? 'bg-aaa-blue text-white shadow-xl' : 'text-aaa-muted hover:text-aaa-blue'}`}>Single Document</button>
                  <button onClick={() => setInputMode('text')} className={`px-10 py-3 rounded-xl text-xs font-black transition-all ${inputMode === 'text' ? 'bg-aaa-blue text-white shadow-xl' : 'text-aaa-muted hover:text-aaa-blue'}`}>Text Injection</button>
                </div>
              </div>

              {inputMode === 'dual' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-6xl mx-auto">
                   <div className="bg-white p-10 rounded-3xl border border-aaa-border shadow-premium border-t-4 border-t-aaa-blue">
                      <h3 className="font-extrabold text-xl text-aaa-blue mb-8">General Baseline</h3>
                      <div onClick={() => generalFileRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all ${generalFile ? 'border-aaa-blue bg-aaa-bg/50' : 'border-aaa-border hover:border-aaa-blue bg-slate-50/30'}`}>
                        <p className="font-black text-sm uppercase tracking-widest">{generalFile ? generalFile.name : 'Select General PDF'}</p>
                        <input type="file" ref={generalFileRef} className="hidden" accept="application/pdf" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], setGeneralFile)} />
                      </div>
                   </div>
                   <div className="bg-white p-10 rounded-3xl border border-aaa-border shadow-premium border-t-4 border-t-aaa-accent">
                      <h3 className="font-extrabold text-xl text-aaa-accent mb-8">Particular Ledger</h3>
                      <div onClick={() => particularFileRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all ${particularFile ? 'border-aaa-accent bg-aaa-bg/50' : 'border-aaa-border hover:border-aaa-accent bg-slate-50/30'}`}>
                        <p className="font-black text-sm uppercase tracking-widest">{particularFile ? particularFile.name : 'Select Particular PDF'}</p>
                        <input type="file" ref={particularFileRef} className="hidden" accept="application/pdf" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], setParticularFile)} />
                      </div>
                   </div>
                   <div className="md:col-span-2 text-center pt-8">
                      <button onClick={() => generalFile && particularFile && handlePdfAnalysis({ general: generalFile, particular: particularFile })} disabled={!generalFile || !particularFile} className="px-20 py-6 bg-aaa-blue text-white rounded-2xl font-black shadow-2xl disabled:opacity-50 transition-all">START VERBATIM COMPARISON</button>
                   </div>
                </div>
              )}

              {inputMode === 'single' && (
                <div onClick={() => fileInputRef.current?.click()} className="bg-white p-24 rounded-3xl border-2 border-dashed border-aaa-border flex flex-col items-center gap-8 hover:border-aaa-blue transition-all cursor-pointer shadow-premium max-w-4xl mx-auto w-full">
                  <div className="w-32 h-32 bg-aaa-bg rounded-2xl flex items-center justify-center text-aaa-blue border border-aaa-blue/10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <h3 className="text-4xl font-black text-aaa-text">Source Injection</h3>
                  <p className="text-aaa-muted -mt-4 text-sm font-bold uppercase tracking-widest">Enhanced Page-by-Page Scan</p>
                  <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], handlePdfAnalysis)} />
                </div>
              )}

              {inputMode === 'text' && (
                <div className="max-w-[1400px] mx-auto w-full space-y-12 animate-in slide-in-from-bottom-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="bg-white p-8 rounded-3xl border border-aaa-border shadow-premium border-t-4 border-t-aaa-blue">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-extrabold text-xl text-aaa-blue">General Baseline</h3>
                        <span className="text-[10px] font-black text-aaa-muted uppercase tracking-widest">{pastedGeneralText.length} Characters</span>
                      </div>
                      <textarea 
                        value={pastedGeneralText}
                        onChange={(e) => setPastedGeneralText(e.target.value)}
                        placeholder="Paste baseline clauses..."
                        className="w-full h-96 bg-aaa-bg/30 p-6 rounded-2xl font-mono text-[13px] leading-relaxed border border-aaa-border focus:border-aaa-blue outline-none custom-scrollbar"
                      />
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-aaa-border shadow-premium border-t-4 border-t-aaa-accent">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-extrabold text-xl text-aaa-accent">Particular Ledger</h3>
                        <span className="text-[10px] font-black text-aaa-muted uppercase tracking-widest">{pastedParticularText.length} Characters</span>
                      </div>
                      <textarea 
                        value={pastedParticularText}
                        onChange={(e) => setPastedParticularText(e.target.value)}
                        placeholder="Paste project-specific modifications..."
                        className="w-full h-96 bg-aaa-bg/30 p-6 rounded-2xl font-mono text-[13px] leading-relaxed border border-aaa-border focus:border-aaa-accent outline-none custom-scrollbar"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-6">
                     <button 
                       onClick={() => (pastedGeneralText.trim() || pastedParticularText.trim()) && handleTextAnalysis(pastedGeneralText, pastedParticularText)} 
                       disabled={!pastedGeneralText.trim() && !pastedParticularText.trim()}
                       className="px-24 py-6 bg-aaa-blue text-white rounded-2xl font-black shadow-2xl disabled:opacity-50 hover:bg-aaa-hover transition-all active:scale-95"
                     >
                       RAPID SCAN (FAST)
                     </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {status === AnalysisStatus.IDLE && userRole !== 'admin' && (
            <div className="space-y-12 max-w-7xl mx-auto pb-20 animate-in fade-in duration-1000">
              <div className="flex items-center justify-between border-b border-aaa-border pb-10">
                <h2 className="text-5xl font-black text-aaa-blue tracking-tighter">Saved Contracts</h2>
              </div>
              {availableContracts.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-aaa-muted text-lg font-bold">No contracts available</p>
                  <p className="text-aaa-muted text-sm mt-2">Contact an admin to upload contracts</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {availableContracts.map(contract => (
                    <div 
                      key={contract.id} 
                      onClick={() => handleContractChange(contract.id)} 
                      className={`group bg-white p-10 rounded-3xl border shadow-premium cursor-pointer transition-all relative flex flex-col hover:-translate-y-1 ${activeContractId === contract.id ? 'border-aaa-blue ring-2 ring-aaa-blue/10' : 'border-aaa-border hover:border-aaa-blue'}`}
                    >
                      <div className="flex justify-between items-start mb-8">
                        <h4 className="text-3xl font-black text-aaa-text truncate tracking-tighter pr-16">{contract.meta.title}</h4>
                      </div>
                      <div className="mt-auto pt-8 border-t border-aaa-border flex justify-between items-center text-[10px] font-black uppercase text-aaa-muted tracking-widest">
                        <span>{contract.meta.createdAt?.toDate ? new Date(contract.meta.createdAt.toDate()).toLocaleDateString() : 'Unknown date'}</span>
                        <span className="px-3 py-1 bg-aaa-bg rounded-lg text-aaa-blue">View Contract</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === AnalysisStatus.ANALYZING && (
            <div className="flex flex-col items-center justify-center py-40 space-y-12 text-center max-w-2xl mx-auto">
              <div className="w-full space-y-6">
                <div className="flex justify-between items-end">
                   <div className="text-left">
                      {inputMode !== 'text' && (
                        <p className="text-[10px] font-black text-aaa-blue uppercase tracking-[0.4em] mb-1">Batch {batchInfo.current} / {batchInfo.total}</p>
                      )}
                      <h3 className="text-3xl font-black text-aaa-blue tracking-tighter">{activeStage.label}</h3>
                   </div>
                   <span className="text-4xl font-black text-aaa-blue mono">{progress}%</span>
                </div>
                <div className="w-full h-4 bg-aaa-bg rounded-full overflow-hidden p-1 border border-aaa-border shadow-inner">
                   <div className="h-full bg-gradient-to-r from-aaa-blue to-aaa-accent rounded-full transition-all duration-300 shadow-lg relative" style={{ width: `${progress}%` }}>
                     <div className="absolute inset-0 bg-white/20 shimmer" />
                   </div>
                </div>
                <p className="text-[10px] font-black text-aaa-muted uppercase tracking-widest">{activeStage.sub}</p>
              </div>
            </div>
          )}

          {status === AnalysisStatus.ERROR && (
            <div className="flex flex-col items-center justify-center py-32 text-center space-y-8 animate-in fade-in">
               <div className="w-24 h-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center border border-red-100 shadow-xl">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               </div>
               <h3 className="text-3xl font-black text-aaa-blue">Process Stalled</h3>
               <p className="text-aaa-muted max-w-md mx-auto">{error}</p>
               <div className="flex gap-4">
                 <button onClick={goBackToInput} className="px-12 py-4 bg-aaa-blue text-white rounded-2xl font-black">Restart Extraction</button>
               </div>
            </div>
          )}

          {status === AnalysisStatus.COMPLETED && (
            <div className="space-y-16 animate-in slide-in-from-bottom-12 pb-20">
              <div className="flex flex-col gap-6 border-b border-aaa-border pb-12">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={projectName} 
                      onChange={(e) => setProjectName(e.target.value)} 
                      onBlur={() => persistCurrentProject()}
                      className="text-7xl font-black text-aaa-blue bg-transparent border-none focus:ring-0 w-full tracking-tighter hover:bg-aaa-bg/50 rounded-2xl transition-all cursor-text outline-none"
                      placeholder="Enter Project Name..."
                    />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <div className="flex items-center gap-3">
                        {isSaving && (
                          <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Session Sync
                          </span>
                        )}
                        <span className="text-[10px] font-black text-aaa-muted uppercase tracking-widest opacity-40">Matrix v2.6.0</span>
                     </div>
                     <p className="text-aaa-muted text-[10px] font-bold uppercase tracking-[0.2em]">{clauses.length} Verbatim Data Nodes</p>
                  </div>
                </div>
              </div>

              <Dashboard clauses={clauses} />

              {(searchResults || searchError || isSearching) && (
                <div className="bg-white p-10 rounded-[32px] border border-aaa-blue/10 shadow-premium animate-in slide-in-from-bottom-6">
                  <div className="flex items-center justify-between mb-8 border-b border-aaa-border pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-aaa-blue rounded-xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-black text-aaa-blue tracking-tighter">Smart Search Results</h3>
                    </div>
                    <button 
                      onClick={() => { setSearchResults(null); setSmartSearchQuery(''); }}
                      className="text-[10px] font-black text-aaa-muted uppercase tracking-widest hover:text-red-500 transition-colors"
                    >
                      Clear Results
                    </button>
                  </div>

                  {isSearching && (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-aaa-muted">
                      <div className="w-8 h-8 border-4 border-aaa-blue border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-black uppercase tracking-[0.3em]">Querying Semantic Matrix...</p>
                    </div>
                  )}

                  {!isSearching && searchResults && searchResults.length > 0 && (
                    <div className="space-y-4">
                      {searchResults.map((res) => (
                        <div 
                          key={res.clause_id}
                          onClick={() => onOpenClause(res.clause_number)}
                          className="group p-6 bg-aaa-bg/30 border border-aaa-border rounded-2xl hover:border-aaa-blue hover:bg-white hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
                        >
                          <div className="absolute right-0 top-0 h-full w-1 bg-aaa-blue transform translate-x-full group-hover:translate-x-0 transition-transform" />
                          <div className="flex items-start justify-between gap-6">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-aaa-blue mono">C.{res.clause_number}</span>
                                <h4 className="text-lg font-black text-aaa-text tracking-tight group-hover:text-aaa-blue transition-colors">{res.title}</h4>
                              </div>
                              <p className="text-[11px] font-bold text-aaa-muted leading-relaxed italic">" {res.reason} "</p>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-black text-aaa-blue opacity-30 uppercase tracking-widest mb-1">Relevance</div>
                              <div className="text-2xl font-black text-aaa-blue tracking-tighter">{(res.relevance_score * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-12 max-w-[1400px] mx-auto">
                {filteredClauses.map((clause, idx) => (
                  <ClauseCard 
                    key={`${clause.clause_number}-${idx}`} 
                    clause={clause} 
                    onCompare={setCompareClause}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onDelete={() => handleDeleteClause(clause.clause_number)}
                  />
                ))}
              </div>
            </div>
          )}

          {status === AnalysisStatus.LIBRARY && (
            <div className="space-y-12 max-w-7xl mx-auto pb-20">
              <div className="flex items-center justify-between border-b border-aaa-border pb-10">
                <h2 className="text-5xl font-black text-aaa-blue tracking-tighter">Secured Archive</h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => importFileRef.current?.click()} 
                    className="px-10 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Backup
                  </button>
                  <input 
                    type="file" 
                    ref={importFileRef} 
                    className="hidden" 
                    accept="application/json,.json" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        console.log('File selected:', file.name, file.size, 'bytes');
                        handleImportContract(file);
                      }
                      // Reset input so same file can be selected again
                      e.target.value = '';
                    }}
                  />
                  {userRole === 'admin' && (
                    <button onClick={() => setStatus(AnalysisStatus.IDLE)} className="px-10 py-4 bg-aaa-blue text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-aaa-hover transition-all">New Extraction</button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {library.map(c => (
                  <div key={c.id} onClick={() => { setClauses(c.clauses); setProjectName(c.name); setActiveContractId(c.id); setStatus(AnalysisStatus.COMPLETED); }} className={`group bg-white p-10 rounded-3xl border shadow-premium cursor-pointer transition-all relative flex flex-col hover:-translate-y-1 ${activeContractId === c.id ? 'border-aaa-blue ring-2 ring-aaa-blue/10' : 'border-aaa-border hover:border-aaa-blue'}`}>
                    <div className="flex justify-between items-start mb-8">
                       <h4 className="text-3xl font-black text-aaa-text truncate tracking-tighter pr-16">{c.name}</h4>
                       <div className="flex gap-2 absolute top-8 right-8">
                          <button onClick={(e) => handleExportContract(e, c)} title="Export to PC" className="p-2.5 bg-emerald-50 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </button>
                          <button onClick={(e) => handleRenameArchive(e, c)} className="p-2.5 bg-aaa-bg text-aaa-muted hover:text-aaa-blue hover:bg-aaa-blue/10 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={(e) => handleDeleteArchive(e, c.id)} className="p-2.5 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                       </div>
                    </div>
                    <div className="mt-auto pt-8 border-t border-aaa-border flex justify-between items-center text-[10px] font-black uppercase text-aaa-muted tracking-widest">
                      <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                      <span className="px-3 py-1 bg-aaa-bg rounded-lg text-aaa-blue">{c.clauses.length} Nodes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {compareClause && (
        <ComparisonModal 
          baseClause={compareClause} 
          allClauses={clauses} 
          onClose={() => setCompareClause(null)} 
          onUpdateClause={handleUpdateClause}
          canEdit={canEdit}
        />
      )}
      
      {isAddModalOpen && (
        <AddClauseModal 
          contractId={activeContractId || 'current-contract'} 
          onClose={() => setIsAddModalOpen(false)} 
          onSave={handleSaveManualClause} 
        />
      )}

      <input 
        type="file" 
        ref={importFileRef} 
        className="hidden" 
        accept="application/json,.json" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            console.log('File selected:', file.name, file.size, 'bytes');
            handleImportContract(file);
          }
          // Reset input so same file can be selected again
          e.target.value = '';
        }}
      />

      <footer className="glass border-t border-aaa-border px-10 h-16 flex items-center justify-between z-10 shrink-0">
         <div className="flex flex-col">
            <p className="text-[9px] font-black text-aaa-muted uppercase tracking-[0.5em]">AAA CONTRACT DEPARTMENT © 2025</p>
         </div>
         <span className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Precision Engine Pro</span>
      </footer>
    </div>
  );
};

export default App;
