import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// #region agent log
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();
fetch('http://127.0.0.1:7245/ingest/daa891dd-57a6-4f18-8bc2-59df6de647d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploadClauses.mjs:11',message:'Script started - checking file location',data:{cwd,__dirname,filename:__filename},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// 1️⃣ Load JSON file (MUST be in same folder)
let expectedFileName = "./Hassan_Allam_s_Contract_Backup_2026-01-13.json";
const expectedFileAbs = path.resolve(expectedFileName);

// #region agent log
const filesInDir = fs.readdirSync(cwd).filter(f => f.toLowerCase().endsWith('.json'));
fetch('http://127.0.0.1:7245/ingest/daa891dd-57a6-4f18-8bc2-59df6de647d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploadClauses.mjs:18',message:'Directory contents check',data:{cwd,expectedFileName,expectedFileAbs,jsonFiles:filesInDir,fileExists:fs.existsSync(expectedFileName),absExists:fs.existsSync(expectedFileAbs)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// #region agent log
if (!fs.existsSync(expectedFileName) && !fs.existsSync(expectedFileAbs)) {
  const similarFiles = filesInDir.filter(f => f.toLowerCase().includes('hassan') || f.toLowerCase().includes('allam') || f.toLowerCase().includes('contract'));
  fetch('http://127.0.0.1:7245/ingest/daa891dd-57a6-4f18-8bc2-59df6de647d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploadClauses.mjs:22',message:'File not found - checking similar files',data:{similarFiles,allFiles:filesInDir},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  
  // Try to find the file with different case or similar name
  if (similarFiles.length > 0) {
    expectedFileName = similarFiles[0];
    console.log(`⚠️  File not found: Hassan_Allam_s_Contract_Backup_2026-01-13.json`);
    console.log(`📁 Found similar file: ${expectedFileName}`);
    console.log(`🔄 Using: ${expectedFileName}\n`);
  } else {
    console.error(`❌ File not found: Hassan_Allam_s_Contract_Backup_2026-01-13.json`);
    console.error(`📂 Current directory: ${cwd}`);
    console.error(`📋 Available JSON files: ${filesInDir.length > 0 ? filesInDir.join(', ') : 'None found'}`);
    console.error(`\n💡 Please ensure the JSON backup file is in the same directory as uploadClauses.mjs`);
    process.exit(1);
  }
}
// #endregion

// #region agent log
fetch('http://127.0.0.1:7245/ingest/daa891dd-57a6-4f18-8bc2-59df6de647d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploadClauses.mjs:27',message:'Attempting to read file',data:{filePath:expectedFileName,fileSize:fs.statSync(expectedFileName).size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
// #endregion

let data;
try {
  data = JSON.parse(fs.readFileSync(expectedFileName, "utf8"));
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/daa891dd-57a6-4f18-8bc2-59df6de647d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploadClauses.mjs:33',message:'File read successfully',data:{hasClauses:!!data.clauses,clauseCount:data.clauses?.length || 0,contractName:data.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
} catch (err) {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/daa891dd-57a6-4f18-8bc2-59df6de647d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'uploadClauses.mjs:37',message:'File read error',data:{error:err.message,code:err.code,path:err.path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  throw err;
}

// 2️⃣ Initialize Firebase (YOUR CONFIG)
const firebaseConfig = {
  apiKey: "AIzaSyDxdTte9QzDdnK_LEdDAFpEodeONlFJuOM",
  authDomain: "aaa-contract-department.firebaseapp.com",
  projectId: "aaa-contract-department",
  storageBucket: "aaa-contract-department.firebasestorage.app",
  messagingSenderId: "907957464792",
  appId: "1:907957464792:web:6e4cbfdd6b93b34496f1ad",
  measurementId: "G-2HBJH3D61R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3️⃣ Upload clauses to Firestore structure: contracts/HassanAllam/clauses/{clauseId}
async function upload() {
  try {
    const contractId = "HassanAllam";
    
    // Create contract metadata
    const metaRef = doc(db, "contracts", contractId, "meta", "meta");
    await setDoc(metaRef, {
      title: data.name || "Hassan Allam's Contract",
      createdBy: "script-upload",
      createdAt: serverTimestamp()
    });
    console.log("✅ Contract metadata created");

    // Upload each clause as a separate document
    if (!data.clauses || !Array.isArray(data.clauses)) {
      throw new Error("No clauses array found in JSON file");
    }

    console.log(`📤 Uploading ${data.clauses.length} clauses...`);
    
    for (let i = 0; i < data.clauses.length; i++) {
      const clause = data.clauses[i];
      
      // Generate clause ID: C.{number} (e.g., C.2.6)
      const clauseId = `C.${(clause.clause_number || clause.number || '').replace(/[^0-9.]/g, '')}`;
      const clauseRef = doc(db, "contracts", contractId, "clauses", clauseId);
      
      await setDoc(clauseRef, {
        id: clauseId,
        number: clause.clause_number || clause.number || '',
        title: clause.clause_title || clause.title || '',
        text: clause.clause_text || clause.text || '',
        conditionType: clause.condition_type || clause.conditionType || 'General',
        general_condition: clause.general_condition || '',
        particular_condition: clause.particular_condition || '',
        comparison: clause.comparison || [],
        has_time_frame: clause.has_time_frame || false,
        time_frames: clause.time_frames || [],
        createdBy: "script-upload",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Uploaded ${i + 1}/${data.clauses.length} clauses...`);
      }
    }

    console.log(`🔥 Upload complete! ${data.clauses.length} clauses uploaded to contracts/${contractId}/clauses`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error uploading:", error);
    process.exit(1);
  }
}

upload();
