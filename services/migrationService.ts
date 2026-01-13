import { getAllContracts } from './dbService';
import { createContract, saveClause } from './firestoreService';
import { SavedContract, Clause } from '../types';

export const migrateIndexedDBToFirestore = async (
  onProgress?: (progress: { current: number; total: number; contractName: string }) => void
): Promise<void> => {
  try {
    const contracts = await getAllContracts();
    
    if (contracts.length === 0) {
      console.log('No contracts to migrate');
      return;
    }

    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      const contractId = contract.id || contract.name.replace(/[^a-zA-Z0-9]/g, '') || `contract-${i}`;
      
      onProgress?.({
        current: i + 1,
        total: contracts.length,
        contractName: contract.name
      });

      // Create contract metadata
      try {
        await createContract(contractId, contract.name);
      } catch (error) {
        // Contract might already exist, continue
        console.log(`Contract ${contractId} might already exist, continuing...`);
      }

      // Migrate clauses
      for (const clause of contract.clauses) {
        try {
          await saveClause(contractId, clause);
        } catch (error) {
          console.error(`Error migrating clause ${clause.clause_number}:`, error);
        }
      }
    }

    // Mark migration as complete
    localStorage.setItem('migration_complete', 'true');
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

export const isMigrationNeeded = (): boolean => {
  return localStorage.getItem('migration_complete') !== 'true';
};
