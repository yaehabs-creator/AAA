import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Clause, ContractMeta } from '../types';

// Contract Metadata Operations
export const loadContracts = async (): Promise<Array<{ id: string; meta: ContractMeta }>> => {
  try {
    const contractsRef = collection(db, 'contracts');
    const contractsSnapshot = await getDocs(contractsRef);
    
    const contracts: Array<{ id: string; meta: ContractMeta }> = [];
    
    for (const contractDoc of contractsSnapshot.docs) {
      const metaDoc = await getDoc(doc(db, 'contracts', contractDoc.id, 'meta', 'meta'));
      if (metaDoc.exists()) {
        contracts.push({
          id: contractDoc.id,
          meta: metaDoc.data() as ContractMeta
        });
      }
    }
    
    return contracts.sort((a, b) => {
      const aTime = a.meta.createdAt?.toMillis?.() || 0;
      const bTime = b.meta.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error loading contracts:', error);
    throw error;
  }
};

export const createContract = async (contractId: string, title: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const metaRef = doc(db, 'contracts', contractId, 'meta', 'meta');
  await setDoc(metaRef, {
    title,
    createdBy: user.uid,
    createdAt: serverTimestamp()
  });
};

export const getContractMeta = async (contractId: string): Promise<ContractMeta | null> => {
  try {
    const metaRef = doc(db, 'contracts', contractId, 'meta', 'meta');
    const metaDoc = await getDoc(metaRef);
    if (metaDoc.exists()) {
      return metaDoc.data() as ContractMeta;
    }
    return null;
  } catch (error) {
    console.error('Error getting contract meta:', error);
    return null;
  }
};

// Clause Operations
export const loadClauses = async (contractId: string): Promise<Clause[]> => {
  try {
    const clausesRef = collection(db, 'contracts', contractId, 'clauses');
    const q = query(clausesRef, orderBy('number'));
    const snapshot = await getDocs(q);
    
    const clauses: Clause[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      clauses.push({
        clause_number: data.number || data.id,
        clause_title: data.title || '',
        condition_type: data.conditionType || data.condition_type || 'General',
        clause_text: data.text || data.clause_text || '',
        general_condition: data.general_condition,
        particular_condition: data.particular_condition,
        comparison: data.comparison || [],
        has_time_frame: data.has_time_frame || false,
        time_frames: data.time_frames || []
      });
    });
    
    // Sort by clause number
    clauses.sort((a, b) => {
      const parse = (s: string) => s.split('.').map(x => parseInt(x) || 0);
      const aP = parse(a.clause_number);
      const bP = parse(b.clause_number);
      for (let i = 0; i < Math.max(aP.length, bP.length); i++) {
        if ((aP[i] || 0) !== (bP[i] || 0)) return (aP[i] || 0) - (bP[i] || 0);
      }
      return 0;
    });
    
    return clauses;
  } catch (error) {
    console.error('Error loading clauses:', error);
    throw error;
  }
};

export const saveClause = async (contractId: string, clause: Clause): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const clauseId = `C.${clause.clause_number.replace(/[^0-9.]/g, '')}`;
  const clauseRef = doc(db, 'contracts', contractId, 'clauses', clauseId);

  await setDoc(clauseRef, {
    id: clauseId,
    number: clause.clause_number,
    title: clause.clause_title,
    text: clause.clause_text,
    conditionType: clause.condition_type,
    general_condition: clause.general_condition || '',
    particular_condition: clause.particular_condition || '',
    comparison: clause.comparison || [],
    has_time_frame: clause.has_time_frame || false,
    time_frames: clause.time_frames || [],
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const deleteClause = async (contractId: string, clauseId: string): Promise<void> => {
  const clauseRef = doc(db, 'contracts', contractId, 'clauses', clauseId);
  await deleteDoc(clauseRef);
};

export const subscribeToClauses = (
  contractId: string,
  callback: (clauses: Clause[]) => void
): Unsubscribe => {
  const clausesRef = collection(db, 'contracts', contractId, 'clauses');
  const q = query(clausesRef, orderBy('number'));

  return onSnapshot(q, (snapshot) => {
    const clauses: Clause[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      clauses.push({
        clause_number: data.number || data.id,
        clause_title: data.title || '',
        condition_type: data.conditionType || data.condition_type || 'General',
        clause_text: data.text || data.clause_text || '',
        general_condition: data.general_condition,
        particular_condition: data.particular_condition,
        comparison: data.comparison || [],
        has_time_frame: data.has_time_frame || false,
        time_frames: data.time_frames || []
      });
    });

    // Sort by clause number
    clauses.sort((a, b) => {
      const parse = (s: string) => s.split('.').map(x => parseInt(x) || 0);
      const aP = parse(a.clause_number);
      const bP = parse(b.clause_number);
      for (let i = 0; i < Math.max(aP.length, bP.length); i++) {
        if ((aP[i] || 0) !== (bP[i] || 0)) return (aP[i] || 0) - (bP[i] || 0);
      }
      return 0;
    });

    callback(clauses);
  }, (error) => {
    console.error('Error in clause subscription:', error);
  });
};
