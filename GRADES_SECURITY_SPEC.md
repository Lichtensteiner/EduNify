# Spécifications de Sécurité Intelligente - Gestion de Notes (Edu-Nify)
## Architecture de Sécurité Académique & Anti-Falsification de Niveau Entreprise

Cette documentation technique de niveau ingénierie définit les principes, les structures de données, les règles de sécurité Firestore, les Cloud Functions et les stratégies réseaux implémentés sur la plateforme **Edu-Nify** pour garantir l'intégrité absolue des notes et empêcher toute fraude ou falsification administrative.

---

## 1. Flow et États du Cycle de Vie d'une Note

Le diagramme d'états d'une note respecte un verrouillage progressif conçu pour résister aux injections, à la triche locale (manipulations client-side injectées) et aux retards d'arbitrage.

```
       [Saisie Enseignant / Import]
                     |
                     v
       +-----------------------------+
       |   EN_ATTENTE_VALIDATION     | <--- Compte à rebours de 48h actif
       +-----------------------------+
          |                       |
          | (Après 48 heures      | (Validation administrative
          |  sans action)         |  manuelle explicite)
          v                       v
       +------------------------------------+
       |   VERROUILLEE (Locked)             | <--- Modifications interdites
       +------------------------------------+
                     |
                     | Requête de Déverrouillage Justifiée (Admin)
                     v
       +------------------------------------+
       |   DEVERROUILLEE_TEMPO (Temp Open)  | <--- Clôture forcée sous 24h
       +------------------------------------+
```

### Règles d'Or Temporelles
1. **Fenêtre modifiable standard (48 heures)** : S'applique dès la création du document à l'état `EN_ATTENTE_VALIDATION`. Un enseignant peut rectifier ses propres erreurs matérielles.
2. **Transition automatique par serveur** : Un déclencheur planifié (Cloud Scheduler + PubSub ou Cloud Firestore Custom Trigger) modifie le statut à `VERROUILLEE` par horodatage d'autorité serveur, ignorant l'heure du client.
3. **Impossibilité de suppression** : Le document physique d'une note ne peut jamais être supprimé (`allow delete: if false;` par règles Firestore). Pour annuler, on procède à une neutralisation logique avec enregistrement de l'historique de modification.

---

## 2. Structure Professionnelle de Donnees (Modèles JSON & Firestore)

Le cloisonnement de données multi-écoles (SaaS) et l'auditabilité instantanée sont matérialisés par trois collections critiques : `/grades` (les notes vivantes), `/grades_history` (l'historique de chaque micro-modification), et `/safety_audit_logs` (le grand livre d'audit pour l'intelligence artificielle et les inspecteurs).

### 2.1 Schéma `/grades/{gradeId}`
```json
{
  "id": "gr_91a0f8bf-12b7-4cc9",
  "schoolId": "sch_abidjan_01",
  "classId": "cl_6eme_a",
  "className": "6ème A",
  "studentId": "usr_stu_00789",
  "studentName": "Yao Kouamé Ange",
  "teacherId": "usr_tea_00342",
  "teacherName": "M. Kouamé (Mathématiques)",
  "subject": "Mathématiques",
  "score": 14.5,
  "maxScore": 20,
  "coefficient": 2,
  "title": "Devoir de Table Trimestre 3",
  "comment": "Très bonne démonstration géométrique",
  "type": "evaluation", // "interrogation" | "evaluation"
  "status": "EN_ATTENTE_VALIDATION", // "EN_ATTENTE_VALIDATION" | "VERROUILLEE" | "DEVERROUILLEE_TEMPO"
  "createdAt": "2026-05-28T13:20:00.000Z", // Timestamp serveur
  "updatedAt": "2026-05-28T13:25:30.000Z", // Timestamp serveur
  "lockDeadline": "2026-05-30T13:20:00.000Z", // createdAt + 48h
  "integrityHash": "db0a83ffcdeba5cf519b763ad2f91ecc4da1b0bb7a1dfa58145fedc5" // HMAC cryptographique généré en sandbox serveur
}
```

### 2.2 Schéma `/grades_history/{historyId}`
L'historique est immuable. Les règles de sécurité désactivent complètement l'écriture utilisateur directe : chaque entrée est insérée exclusivement par un déclencheur Firestore Cloud Function d'arrière-plan.
```json
{
  "id": "gh_44b0e8c1-3fcf-49b8",
  "gradeId": "gr_91a0f8bf-12b7-4cc9",
  "schoolId": "sch_abidjan_01",
  "modifiedBy": "usr_tea_00342",
  "modifiedByName": "M. Kouamé (Mathématiques)",
  "modifiedByRole": "enseignant",
  "modifiedAt": "2026-05-28T13:25:30.000Z",
  "oldScore": 13.0,
  "newScore": 14.5,
  "changeReason": "Correction d'une erreur de report suite à réclamation de l'élève",
  "ipAddress": "197.234.221.43",
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1...)",
  "isSuspicious": false
}
```

### 2.3 Schéma `/safety_audit_logs/{logId}`
Ce grand livre immuable enregistre l'ensemble des tentatives malicieuses (modifications après date limite, tentatives de contournement de permissions par reverse engineering des applications ou failles de scripts).
```json
{
  "id": "sal_cfdb91b8-a774-4b9d",
  "schoolId": "sch_abidjan_01",
  "timestamp": "2026-05-28T13:27:43.000Z",
  "actorId": "usr_tea_00342",
  "actorRole": "enseignant",
  "actorName": "M. Kouamé (Mathématiques)",
  "event": "GRADE_LOCK_BYPASS_ATTEMPT",
  "severity": "CRITICAL", // "INFO" | "WARNING" | "CRITICAL"
  "payload": {
    "gradeId": "gr_91a0f8bf-12b7-4cc9",
    "attemptedChanges": { "score": 19.5 },
    "detectedError": "PERMISSION_DENIED: Modifying locked document without administrator temp authorization."
  },
  "geoloc": {
    "country": "Côte d'Ivoire",
    "city": "Abidjan"
  }
}
```

---

## 3. Regles de Securite Firestore Avancees (`firestore.rules`)

Ces règles constituent la première muraille contre les attaques directes sur l'API Firestore. Elles s'appliquent en temps réel côté réseau Google, assurant qu'aucun client ne puisse outrepasser la logique de verrouillage des 48h.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper : Récupérer les métadonnées de l'utilisateur connecté
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Helper : Vérifier si l'utilisateur appartient à la même école (cloisonnement SaaS)
    function isSameSchool(resourceData) {
      return resourceData.schoolId == getUserData().schoolId;
    }

    // Helper : Vérifie si le rôle de l'acteur fait de lui un administrateur ou super admin
    function isAdmin() {
      return request.auth != null && 
        (getUserData().role == 'admin' || getUserData().role == 'Super Admin' || getUserData().role == 'Directeur');
    }

    match /grades/{gradeId} {
      
      // Lecture des notes : Cloisonnée par école pour préserver l'accès SaaS sécurisé
      allow read: if request.auth != null && (
        isAdmin() ||
        (getUserData().role == 'enseignant' && isSameSchool(resource.data)) ||
        (getUserData().role == 'élève' && resource.data.studentId == request.auth.uid) ||
        (getUserData().role == 'parent' && resource.data.studentId in getUserData().childrenIds)
      );

      // Création de notes
      allow create: if request.auth != null && (
        isAdmin() || 
        (getUserData().role == 'enseignant' && 
         request.resource.data.status == 'EN_ATTENTE_VALIDATION' &&
         request.resource.data.teacherId == request.auth.uid &&
         request.resource.data.createdAt == request.time) // Horodatage serveur strict
      );

      // Mise à jour de notes : Cœur d'application des règles de verrouillage de 48h
      allow update: if request.auth != null && (
        // Cas 1 : Super Admin/Admin de l'établissement qui déverrouille/rectifie
        isAdmin() ||
        
        // Cas 2 : L'enseignant auteur originel de la note
        (getUserData().role == 'enseignant' && 
         resource.data.teacherId == request.auth.uid &&
         resource.data.status == 'EN_ATTENTE_VALIDATION' &&
         // Vérifie si la période de tolérance de 48h n'est pas expirée
         request.time < resource.data.lockDeadline &&
         // L'enseignant ne peut jamais changer le statut ou le verrouillage lui-même
         request.resource.data.status == resource.data.status &&
         request.resource.data.lockDeadline == resource.data.lockDeadline)
      );

      // SÉCURITÉ ABSOLUE : Impossibilité logique et physique de suppression
      allow delete: if false;
    }

    // Historique des modifications : Immuable en écriture client, géré uniquement par les triggers serveurs (Cloud Functions)
    match /grades_history/{historyId} {
      allow read: if request.auth != null && (isAdmin() || getUserData().role == 'enseignant');
      allow create: if false; // Rejet de l'écriture client
      allow update: if false; // Rejet de la modification
      allow delete: if false; // Rejet de la suppression
    }

    // Logs d'audit : Écriture réservée au SDK serveur
    match /safety_audit_logs/{logId} {
      allow read: if request.auth != null && getUserData().role == 'Super Admin';
      allow write: if false;
    }
  }
}
```

---

## 4. Cloud Functions Professionnelles (Gestion Automatique)

### 4.1 Déclencheur Automatique de Verrouillage (Cron Planner ou Firestore Trigger)
Cette Cloud Function s’exécute régulièrement pour identifier et verrouiller automatiquement toutes les notes qui ont expiré le seuil des 48h depuis leur saisie.

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Scheduler planifié toutes les heures pour verrouiller les notes expirées de 48 heures.
 */
export const lockGradesHourly = functions.pubsub
  .schedule("0 * * * *")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const quizQuery = db.collection("grades")
      .where("status", "==", "EN_ATTENTE_VALIDATION")
      .where("lockDeadline", "<=", now);

    const snapshot = await quizQuery.get();

    if (snapshot.empty) {
      functions.logger.info("Aucun devoir à verrouiller durant ce cycle.");
      return null;
    }

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "VERROUILLEE",
        updatedAt: now
      });

      // Création automatique de log d'audit
      const logRef = db.collection("safety_audit_logs").doc();
      batch.set(logRef, {
        schoolId: doc.data().schoolId,
        timestamp: now,
        actorId: "SYSTEM_SCHEDULER",
        actorRole: "system",
        actorName: "Moteur de Verrouillage Académique",
        event: "GRADE_AUTO_LOCKED",
        severity: "INFO",
        payload: {
          gradeId: doc.id,
          lockDeadline: doc.data().lockDeadline
        }
      });
    });

    await batch.commit();
    functions.logger.info(`${snapshot.size} notes ont été automatiquement verrouillées.`);
    return null;
  });
```

### 4.2 Historisation Automatique & Grand Livre Immuable (Trigger Firestore `onUpdate`)
Dès qu'une modification survient sur une note, cette fonction écrit instantanément l'historique de modification et vérifie les écarts anormaux.

```typescript
export const onGradeChangeHistory = functions.firestore
  .document("grades/{gradeId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const now = admin.firestore.Timestamp.now();

    // S'il n'y a pas de changement sur la note, on ignore
    if (beforeData.score === afterData.score) return null;

    // Détection de modification suspecte (+ de 8 points d'écart)
    const delta = Math.abs(afterData.score - beforeData.score);
    const isSuspicious = delta >= 8.0;

    const historyPayload = {
      gradeId: context.params.gradeId,
      schoolId: afterData.schoolId,
      modifiedBy: afterData.modifiedBy || afterData.teacherId,
      modifiedByName: afterData.modifiedByName || afterData.teacherName,
      modifiedByRole: afterData.modifiedByRole || "enseignant",
      modifiedAt: now,
      oldScore: beforeData.score,
      newScore: afterData.score,
      changeReason: afterData.changeReason || "Rectification d'erreur logicielle",
      isSuspicious: isSuspicious
    };

    const batch = db.batch();

    // 1. Ajouter l'historique immuable
    const historyRef = db.collection("grades_history").doc();
    batch.set(historyRef, historyPayload);

    // 2. Si anomalie détectée, lever une alerte de sécurité critique
    if (isSuspicious) {
      const securityAlertRef = db.collection("safety_audit_logs").doc();
      batch.set(securityAlertRef, {
        schoolId: afterData.schoolId,
        timestamp: now,
        actorId: afterData.modifiedBy || afterData.teacherId,
        actorRole: "enseignant",
        actorName: afterData.teacherName,
        event: "SUSPICIOUS_GRADE_SPIKE_DETECTED",
        severity: "CRITICAL",
        payload: {
          gradeId: context.params.gradeId,
          delta: delta,
          oldScore: beforeData.score,
          newScore: afterData.score,
          reason: afterData.changeReason
        }
      });

      // Émettre une notification push Firebase Cloud Messaging vers les administrateurs
      const payloadMessage = {
        notification: {
          title: "🚨 Alerte Fraude / Écart Note Suspect",
          body: `La note de ${afterData.studentName} en ${afterData.subject} a été modifiée de ${beforeData.score} à ${afterData.score} (+${delta} pts).`
        },
        topic: `admin_alerts_${afterData.schoolId}`
      };
      await admin.messaging().send(payloadMessage).catch(err => {
        functions.logger.error("Erreur d'envoi de notification FCM : ", err);
      });
    }

    await batch.commit();
    return null;
  });
```

---

## 5. Intelligence Anti-Fraude & Détection des Anomalies

Le moteur analyse en temps réel les dérives comportementales des utilisateurs via des indicateurs avancés d'intelligence d'audit :

1. **Vigilance horaires non scolaires** : Modifications de notes saisies entre 22h00 et 05h00, souvent corrélées à des piratages de sessions ou vols d'identifiants de professeurs.
2. **Indice de volatilité des notes (Spike Detector)** : Un écart instantané de score $\ge 40\%$ de la note maximale (ex: passage de 05/20 à 18/20) génère automatiquement une mise sous séquestre administrative de la note.
3. **Comportement de brutes-forces de déverrouillage** : Multiples appels API pour modifier des documents d'états `VERROUILLEE` par un même jeton d'authentification utilisateur. Le compte suspect est immédiatement flaggé, restreint d'accès et signalé aux responsables d'établissement.
4. **Validation par Double-Paire Signature** : Chaque note intègre un `integrityHash` calculé sur les champs immuables (`studentId`, `subject`, `score`, `createdAt`) chiffré par une clé secrète serveur. Si l'application cliente tente d'altérer la note sans passer par l'API valide, la vérification de condensat cryptographique échouera.

---

## 6. Résilience aux Fatigues Réseau (Connexions faibles d'Afrique)

Pour les établissements en zones à connectivité satellite ou mobile fluctuante, Edu-Nify utilise une stratégie de synchronisation offline robuste :

- **File d'Attente Transactionnelle Locale (Offline Transactions Manager)** : S'appuyant sur l'activation de `enableIndexedDbPersistence()` côté SDK client Firestore, les enseignants peuvent saisir leurs notes sans connexion mobile. 
- **Verrouillage Relatif Garanti (Clock Skew Mitigation)** : En cas d'écriture décalée après retour en ligne, le délai de 48 heures est calculé au moment précis de l'arrivée de la transaction sur le serveur grâce aux triggers utilisant `FieldValue.serverTimestamp()`, neutralisant tout risque de contournement en modifiant l'heure locale d'un téléphone mobile.
- **Requêtes Optimisées de Facturation (Cost Saving Firestore)** : Structuration en index composites spécifiques évitant les scans complets de tables et l'usage de requêtes d'agrégation locales au lieu de lectures multiples et coûteuses par utilisateur.
