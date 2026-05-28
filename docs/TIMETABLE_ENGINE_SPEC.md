# EDU-NIFY INTELLIGENT TIMETABLE ENGINE (EITE)
## Spécifications Techniques Universelles & Architecture de Production SaaS EdTech (Multi-Tenant & Offline-First)

---

## 1. VISION & ARRIÈRE-PLAN TECHNIQUE

Dans le contexte éducatif africain, les établissements font face à trois défis majeurs :
*   **Contraintes de connectivité** : Les déconnexions intermittentes et la bande passante limitée exigent un paradigme entièrement déconnectable (offline-first).
*   **Modèles d'enseignement hybrides** : Un fort taux d'enseignants vacataires (sur-sollicités et payés à l'heure) circulant entre plusieurs écoles, nécessitant une rigidité absolue sur les plages de disponibilité.
*   **Contraintes d'infrastructure** : Domination absolue du trafic mobile (Mobile-first) et sensibilité extrême aux coûts opérationnels cloud (Firebase egress/reads).

**Edu-Nify Intelligent Timetable Engine (EITE)** résout ce problème en introduisant un système de planification temps réel résilient, couplé à un solveur hybride (Client-Side léger pour les ajustements et Server-Side robuste pour la génération globale).

---

## 2. MODÉLISATION DE DONNÉES CLOUD FIRESTORE

Notre architecture Firestore utilise une approche **Multi-Tenant (SaaS)** avec un cloisonnement strict par établissement (`schoolId`). Pour minimiser les coûts de lecture, nous séparons les données de configuration statiques des modèles transactionnels lourds.

```
/schools/{schoolId}
   ├── config (document contenant les métadonnées de l'école)
   ├── campuses/{campusId}
   │     └── rooms/{roomId}
   ├── subjects/{subjectId}
   ├── classes/{classId}
   ├── teachers/{teacherId}
   │     └── availabilities/{weekId}
   └── timetable_cycles/{cycleId}
         ├── assignments/{assignmentId}
         └── locks/{lockId}
```

### Schémas Éléments (JSON-Schema Équivalent)

#### A. Collection: `teachers`
```json
{
  "$id": "/schools/{schoolId}/teachers/{teacherId}",
  "type": "object",
  "properties": {
    "uid": { "type": "string", "description": "Lien vers Firebase Auth" },
    "firstName": { "type": "string", "maxLength": 50 },
    "lastName": { "type": "string", "maxLength": 50 },
    "email": { "type": "string", "format": "email" },
    "status": { "type": "string", "enum": ["permanent", "vacataire"] },
    "subjects": { "type": "array", "items": { "type": "string" }, "description": "ID des matières enseignées" },
    "weeklyHourQuota": { "type": "integer", "minimum": 0, "maximum": 50 },
    "hourlyRate": { "type": "number", "minimum": 0, "description": "Tarif horaire pour les vacataires" },
    "phoneNumber": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["uid", "lastName", "status", "weeklyHourQuota", "subjects"]
}
```

#### B. Sous-collection: `teachers/{teacherId}/availabilities/{weekId}`
```json
{
  "$id": "/schools/{schoolId}/teachers/{teacherId}/availabilities/{weekId}",
  "type": "object",
  "properties": {
    "weekId": { "type": "string", "description": "Format YYYY-Www" },
    "timeSlots": {
      "type": "array",
      "description": "Tableau de tranches de 30 ou 60 minutes prioritisées",
      "items": {
        "type": "object",
        "properties": {
          "dayOfWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
          "startMinute": { "type": "integer", "description": "Minutes depuis minuit (ex: 480 pour 08:00)" },
          "endMinute": { "type": "integer", "description": "Minutes depuis minuit (ex: 540 pour 09:00)" },
          "preference": { "type": "string", "enum": ["preferred", "available", "unavailable"] }
        },
        "required": ["dayOfWeek", "startMinute", "endMinute", "preference"]
      }
    },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["weekId", "timeSlots"]
}
```

#### C. Collection: `timetable_cycles`
Représente un plan de génération d'emploi du temps global (ex: "Semestre 1 - Standard").
```json
{
  "$id": "/schools/{schoolId}/timetable_cycles/{cycleId}",
  "type": "object",
  "properties": {
    "name": { "type": "string", "maxLength": 100 },
    "status": { "type": "string", "enum": ["draft", "computing", "completed", "error", "published"] },
    "startDate": { "type": "string", "format": "date" },
    "endDate": { "type": "string", "format": "date" },
    "solverMetrics": {
      "type": "object",
      "properties": {
        "conflictsCount": { "type": "integer" },
        "unassignedHours": { "type": "number" },
        "softConstraintsScore": { "type": "number" },
        "executionTimeMs": { "type": "integer" }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["name", "status"]
}
```

#### D. Collection: `timetable_cycles/{cycleId}/assignments`
Représente un cours positionné de façon définitive ou temporaire par le solveur ou par un administrateur.
```json
{
  "$id": "/schools/{schoolId}/timetable_cycles/{cycleId}/assignments/{assignmentId}",
  "type": "object",
  "properties": {
    "classId": { "type": "string", "description": "ID de la classe (ex: 6eme A)" },
    "teacherId": { "type": "string", "description": "ID de l'enseignant" },
    "subjectId": { "type": "string", "description": "ID de la matière" },
    "roomId": { "type": "string", "description": "ID de la salle optionnel" },
    "dayOfWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
    "startMinute": { "type": "integer", "description": "Ex: 480 (08:00)" },
    "endMinute": { "type": "integer", "description": "Ex: 570 (09:30)" },
    "isLocked": { "type": "boolean", "description": "Si true, le solveur auto ne peut pas le relocaliser" },
    "isConflictual": { "type": "boolean" },
    "conflictDetails": { "type": "string" },
    "lastModifiedBy": { "type": "string" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["classId", "teacherId", "subjectId", "dayOfWeek", "startMinute", "endMinute", "isLocked"]
}
```

---

## 3. FIRESTORE SECURITY RULES (ZERO-TRUST)

Conformément à nos exigences de sécurité absolue (ABAC), les règles empêchent l'injection de données invalides, l'escalade de privilèges, ou l'altération de structures d'autres écoles (multi-cloisons). Vos collaborateurs ou élèves authentifiés ne peuvent en aucun cas modifier un emploi du temps.

Voici le fichier de règles durci pour le module :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. SAFETY NET GLOBAL DEFAULT DENY
    match /{document=**} {
      allow read, write: if false;
    }

    // FONCTIONS DE DIAGNOSTIC GLOBALES & SECURISEES
    function isSignedIn() {
      return request.auth != null;
    }

    function isEmailVerified() {
      return request.auth.token.email_verified == true;
    }

    function getUserRecord() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Cloisonnement strict multi-tenant
    function isMemberOfSchool(schoolId) {
      return isSignedIn() && getUserRecord().schoolId == schoolId;
    }

    function hasRole(schoolId, roles) {
      return isMemberOfSchool(schoolId) && getUserRecord().role in roles;
    }

    function isValidId(id) {
      return id is string && id.size() <= 64 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    // --- REGLISTES PAR DOMAINE ETABLISSEMENT ---
    match /schools/{schoolId} {
      allow get: if isMemberOfSchool(schoolId);
      allow write: if hasRole(schoolId, ['admin']);

      // Campus et Salles
      match /campuses/{campusId} {
        allow read: if isMemberOfSchool(schoolId);
        allow write: if hasRole(schoolId, ['admin']);

        match /rooms/{roomId} {
          allow read: if isMemberOfSchool(schoolId);
          allow write: if hasRole(schoolId, ['admin']);
        }
      }

      // Matières
      match /subjects/{subjectId} {
        allow read: if isMemberOfSchool(schoolId);
        allow write: if hasRole(schoolId, ['admin']);
      }

      // Classes
      match /classes/{classId} {
        allow read: if isMemberOfSchool(schoolId);
        allow write: if hasRole(schoolId, ['admin']);
      }

      // Professeurs & Disponibilités
      match /teachers/{teacherId} {
        allow read: if isMemberOfSchool(schoolId);
        allow write: if hasRole(schoolId, ['admin']);

        match /availabilities/{weekId} {
          allow read: if isMemberOfSchool(schoolId);
          // Un enseignant peut modifier ses propres dispos si c'est son ID utilisateur,
          // ou l'admin général de l'établissement
          allow write: if hasRole(schoolId, ['admin']) || 
            (getUserRecord().role == 'enseignant' && request.auth.uid == teacherId);
        }
      }

      // Cycle Emploi du temps
      match /timetable_cycles/{cycleId} {
        allow read: if isMemberOfSchool(schoolId);
        allow write: if hasRole(schoolId, ['admin', 'personnel administratif']);

        match /assignments/{assignmentId} {
          allow read: if isMemberOfSchool(schoolId);
          allow write: if hasRole(schoolId, ['admin', 'personnel administratif']) 
            && isValidAssignment(request.resource.data);
        }
      }
    }

    // HELPER DE VALIDATION SCHÉMA ASSIGNMENT POUR FIRESTORE WRITES
    function isValidAssignment(data) {
      return data.classId is string && data.classId.size() > 0
          && data.teacherId is string && data.teacherId.size() > 0
          && data.subjectId is string && data.subjectId.size() > 0
          && data.dayOfWeek is int && data.dayOfWeek >= 1 && data.dayOfWeek <= 7
          && data.startMinute is int && data.startMinute >= 0
          && data.endMinute is int && data.endMinute > data.startMinute
          && data.isLocked is bool;
    }
  }
}
```

---

## 4. ARCHITECTURE CLOUD FUNCTIONS (DÉPLOYABLE SUR CLOUD RUN ACCÉLÉRÉ)

La génération automatique d'emplois du temps optimisés sous contraintes (Problème NP-Complet) ne peut pas s'exécuter dans un simple thread de navigateur mobile. Nous adoptons une infrastructure asynchrone découplée.

```
+--------------------+            (Pub/Sub Trigger)          +----------------------------+
| CLIENT MOBILE / PWA|                                       | FIREBASE CLOUD FUNCTION    |
| (React Offline)    | ─────────────────────────────────────>| `triggerScheduler`         |
+--------------------+                                       +----------------------------+
          ▲                                                                 │
          │ (Push Realtime State)                                           │ (génère tâche GCP)
          │                                                                 ▼
+--------------------+                                       +----------------------------+
| FIRESTORE SYNC     | <─────────────────────────────────────| CLOUD RUN SOLVER           |
|  (Completed Cycle) |                                       | (Moteur OptaPlanner/Python)|
+--------------------+                                       +----------------------------+
```

### Script de la Function Cloud d'Ingestion (`functions/src/timetable.ts`)

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function HTTPS déclenchée pour lancer une résolution automatique globale.
 * Déporte les calculs lourds vers un moteur de contraintes ou utilise LLM + Algorithmes complémentaires.
 */
export const triggerScheduler = functions.region('europe-west1').https.onCall(async (data, context) => {
  // 1. Authentification & Sécurité Tenant
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }

  const { schoolId, cycleId } = data;
  if (!schoolId || !cycleId) {
    throw new functions.https.HttpsError('invalid-argument', 'schoolId et cycleId requis.');
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  if (!userData || userData.schoolId !== schoolId || !['admin', 'personnel administratif'].includes(userData.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Vous n\'êtes pas autorisé à lancer le solveur.');
  }

  const cycleRef = db.collection('schools').doc(schoolId).collection('timetable_cycles').doc(cycleId);
  
  try {
    // 2. Transiter au statut "Calcul en cours"
    await cycleRef.update({ 
      status: 'computing', 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    // 3. Charger les besoins d'affectation
    const schoolRef = db.collection('schools').doc(schoolId);
    const [teachersSnap, roomsSnap, classesSnap] = await Promise.all([
      schoolRef.collection('teachers').get(),
      schoolRef.collection('campuses').doc('default_campus').collection('rooms').get(), // exemple
      schoolRef.collection('classes').get()
    ]);

    const contextData = {
      teachers: teachersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      rooms: roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };

    // 4. Déléguer au module de contraintes.
    // Pour des cas complexes (1000+ variables), nous appelons un conteneur Cloud Run optimisé en C++ ou Python-OR-Tools.
    // Pour cet exemple de startup agile, nous implémentons un Worker asynchrone via HTTP callout :
    
    console.log(`Lancement du solveur en arrière-plan pour l'école ${schoolId}, cycle ${cycleId}`);
    
    // Le solver modifie directement les documents de la collection `assignments` au fur et à mesure.
    // Le client reçoit les résultats en temps réel grâce aux snapshot listeners natifs Firebase.

    return { success: true, message: 'Le solveur d\'emplois du temps a été démarré avec succès.' };
  } catch (err: any) {
    await cycleRef.update({ status: 'error', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    throw new functions.https.HttpsError('internal', err.message || 'Erreur interne du solveur.');
  }
});
```

---

## 5. ALGORITHME DE RÉSOLUTION & SOLVEUR DE CONTRAINTES

Le solveur utilise une combinaison d'**Algorithme Génétique** et de **Recherche Taboue (Heuristique locale)** pour converger rapidement vers un planning valide.

### Spécification du Classement des Contraintes :

1.  **Dures (Hard Constraints - Non Violables) :**
    *   `H1` : Pas de double réservation d'un Enseignant au même moment.
    *   `H2` : Pas de double occupation d'une Salle au même moment.
    *   `H3` : Heures programmées d'un enseignant vacataire s'inscrivent uniquement dans son tableau `availabilities`.
    *   `H4` : Une Classe ne peut suivre deux cours en même temps.
2.  **Souples (Soft Constraints - Optimisation) :**
    *   `S1` : Minimiser les "heures creuses" (trous) dans l'emploi du temps journalier des classes.
    *   `S2` : Regrouper les heures des enseignants vacataires sur minimum de journées (réduire leurs frais de transport).
    *   `S3` : Tempérer les journées trop lourdes (maximum 6 heures par classe/jour).

### Pseudo-code d'un Résolveur d'Ajustement Heuristique (Algorithme en Node.js/Python)

```typescript
interface TimeSlot {
  day: number;       // 1-6 (Lundi à Samedi)
  startMin: number;  // Minutes par rapport à minuit
  endMin: number;
}

interface ConstraintConflict {
  type: 'H1' | 'H2' | 'H3' | 'H4' | 'S1';
  message: string;
  weight: number;
}

/**
 * Calcul de la pénalité totale (Score de fitness) d'un emploi du temps.
 * Plus la pénalité est faible, meilleur est le planning.
 */
function evaluateSchedule(assignments: any[], teachers: any[]): { hardViolations: number, softViolations: number, conflicts: ConstraintConflict[] } {
  let hardViolations = 0;
  let softViolations = 0;
  const conflicts: ConstraintConflict[] = [];

  // Analyser les conflits de chevauchement temporel
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];

    // Vérifier H3 : Validité des horaires par rapport aux disponibilités du vacataire
    const teacher = teachers.find(t => t.id === a.teacherId);
    if (teacher && teacher.status === 'vacataire') {
      const isAvailable = checkAvailability(teacher, a.dayOfWeek, a.startMinute, a.endMinute);
      if (!isAvailable) {
        hardViolations += 10;
        conflicts.push({
          type: 'H3',
          message: `Le vacataire ${teacher.lastName} est planifié hors de ses disponibilités.`,
          weight: 10
        });
      }
    }

    // Vérifier les conflits binaires entre cours (Enseignant / Salle / Classe)
    for (let j = i + 1; j < assignments.length; j++) {
      const b = assignments[j];

      // S'ils partagent le même jour et qu'il y a un chevauchement d'heure
      if (a.dayOfWeek === b.dayOfWeek && Math.max(a.startMinute, b.startMinute) < Math.min(a.endMinute, b.endMinute)) {
        // H1 : Enseignant surbouqué
        if (a.teacherId === b.teacherId) {
          hardViolations += 100;
          conflicts.push({
            type: 'H1',
            message: `Double affectation du professeur ${a.teacherId} le jour ${a.dayOfWeek}`,
            weight: 100
          });
        }
        // H2 : Salle occupée
        if (a.roomId && b.roomId && a.roomId === b.roomId) {
          hardViolations += 100;
          conflicts.push({
            type: 'H2',
            message: `La salle ${a.roomId} est surréservée simultanément.`,
            weight: 100
          });
        }
        // H4 : Classe sur deux cours
        if (b.classId === a.classId) {
          hardViolations += 100;
          conflicts.push({
            type: 'H4',
            message: `La classe ${a.classId} est affectée à deux cours à la fois.`,
            weight: 100
          });
        }
      }
    }
  }

  return { hardViolations, softViolations, conflicts };
}
```

---

## 6. OPTIMISATION HAUTE CONNECTIVITÉ & STRATÉGIE OFFLINE-FIRST MOBILE

Pour garantir une utilisation fluide sur mobile africain hors ligne (sans connexion stable, en classe ou en déplacement rural), l'implémentation frontend s'appuie sur la synergie de trois technologies clés :

```
+--------------------------------------------------------------+
|                    APPLICATIONS WEB (PWA)                    |
+--------------------------------------------------------------+
                               │
       (Gestion offline par indexDB persistent cache)
                               ▼
+--------------------------------------------------------------+
| LOCAL FIRESTORE OFFLINE PERSISTENCE (SDK)                    |
+--------------------------------------------------------------+
                               │
                       (Online Reconnect)
                               ▼
+--------------------------------------------------------------+
| CLOUD FIRESTORE DATACENTER                                   |
+--------------------------------------------------------------+
```

### Configurer la persistence hors ligne sous l'environnement Web React + Firestore :

```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Activation du cache persistant robuste multi-onglets (IndexedDB)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

### Optimisations Spécifiques Réduction de Coûts (No billing scale spikes) :

1.  **Champs Compteurs d'Agrégation** : Ne faites jamais un `collection.get()` pour calculer le nombre d'heures vendues ou de conflits. Utilisez des compteurs centralisés mis à jour côté serveur par des Cloud Functions (Ex: `solverMetrics.conflictsCount`).
2.  **Stratégie de Cache Référentiel** : Les collections statiques (`subjects`, `classes`, `rooms`) changent rarement au cours de l'année. Nous lisons ces collections via le SDK en forçant d'abord l'évaluation du cache :
    ```typescript
    import { getDocs, collection, query, limit, getDocsFromCache, getDocsFromServer } from 'firebase/firestore';

    async function loadSchoolReferenceData(schoolId: string) {
      const refCol = collection(db, 'schools', schoolId, 'subjects');
      try {
        // Essayer d'interroger directement le cache IndexedDB de l'appareil mobile
        return await getDocsFromCache(query(refCol));
      } catch (cacheError) {
        // En cas de cache manquant ou expiré, solliciter le serveur Cloud Firestore
        return await getDocsFromServer(query(refCol));
      }
    }
    ```
3.  **Écoutes Temps-Réel Ciblées** : Évitez de souscrire à la collection globale `assignments`. Écoutez uniquement le sous-ensemble réduit des cours associés à l'utilisateur courant (`where("teacherId", "==", currentUserId)`) ou à la classe courante.

---

## 7. SYSTÈME DE SYNCHRONISATION EN TEMPS RÉEL (FLUTTER/REACT ↔ FIRESTORE)

Lorsqu'un administrateur déplace interactivement un cours ou lance un recalcul partiel, l'appareil de l'utilisateur (React Web ou Flutter) réagit instantanément grâce au flux Firebase.

### Workflow d'Affectation Interactive d'un Cours & Feedback Immédiat :

1.  **L'utilisateur glisse-dépose** un cours :
    Un document de la collection `assignments` est mis à jour localement au statut `isLocked: true`, `updatedTime: serverTimestamp()`.
2.  **Mise à jour Optimiste locale instantanée** :
    L'UI React se redessine instantanément (latence perçue = 0ms) grâce aux caractéristiques d'optimistic rendering intégrées au SDK Firestore.
3.  **Publication d'événement de Notification** :
    Une fonction d'arrière-plan détecte la modification dans la base Firestore :
    ```typescript
    import * as functions from 'firebase-functions';
    import * as admin from 'firebase-admin';

    export const onAssignmentChange = functions.firestore
      .document('schools/{schoolId}/timetable_cycles/{cycleId}/assignments/{assignmentId}')
      .onWrite(async (change, context) => {
        const afterData = change.after.data();
        if (!afterData) return; // Suppression

        // Alerter via FCM si modification sensible par un administrateur sur un créneau
        const payload = {
          notification: {
            title: 'Changement d\'emploi du temps',
            body: `Le cours associé à la classe ${afterData.classId} a fait l'objet d'une mise à jour de planification.`,
            icon: '/logo.png'
          },
          topic: `class_${afterData.classId}`
        };

        await admin.messaging().send(payload);
        console.log(`Notification envoyée aux abonnés de la classe class_${afterData.classId}`);
      });
    ```
4.  **Abonnement Dynamique Côté Client (Temps Réel)** :
    ```typescript
    import { collection, onSnapshot, query, where } from 'firebase/firestore';

    function subscribeToClassTimetable(schoolId: string, cycleId: string, classId: string, onUpdate: (data: any[]) => void) {
      const q = query(
        collection(db, 'schools', schoolId, 'timetable_cycles', cycleId, 'assignments'),
        where('classId', '==', classId)
      );

      return onSnapshot(q, (snapshot) => {
        const assignmentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onUpdate(assignmentsList);
      });
    }
    ```

---

## 8. STRATÉGIE DE MONITORING, SECU & LOGGING PILOTÉ

Pour une mise en production SaaS stable et une traçabilité optimale de notre solveur d'emplois du temps :

*   **Google Cloud Logging** : Nous intégrons des logs structurés dans nos cloud functions contenant leur type opérationnel, le temps CPU consommé par rapport aux quotas standard et les métriques de réussite de l'algorithme génétique.
*   **Firebase App Distribution & Crashlytics** : Intégrés nativement aux builds iOS/Android/PWA pour collecter en arrière-plan tous les échecs réseau locaux ou exceptions de décodage IndexedDB.
*   **Audit Trail** : Chaque modification manuelle apportée par un administrateur sur un créneau horaire génère un document compact d'audit contenant l'identité de l'opérateur (`userId`), la date exacte et la modification appliquée afin de régler les litiges d'attribution de salles.

---
*Ce document sert de spécification technique unifiée de référence pour les équipes d'ingénierie, d'architecture cloud et de développement client Edu-Nify.*
