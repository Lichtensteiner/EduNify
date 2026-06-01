import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API registration secure endpoints
  app.post("/api/auth/register/student", (req, res) => {
    const { nom, prenom, email, password, confirmPassword, matricule, classe, dateNaissance, lieuNaissance } = req.body;
    
    if (!nom || !prenom || !email || !password || !confirmPassword || !matricule || !classe || !dateNaissance || !lieuNaissance) {
      return res.status(400).json({ error: "Tous les champs obligatoires doivent être renseignés (Nom, Prénom, Matricule, Classe, Date et Lieu de naissance, Email, Mot de passe)." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "La confirmation du mot de passe ne correspond pas au mot de passe saisi." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe de l'élève doit avoir une longueur minimum de 6 caractères." });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Format de l'e-mail invalide." });
    }

    // Age validation
    try {
      const birthDateObj = new Date(dateNaissance);
      const age = new Date().getFullYear() - birthDateObj.getFullYear();
      if (age < 3 || age > 25) {
        return res.status(400).json({ error: "L'âge de l'élève à l'inscription doit être compris entre 3 ans et 25 ans." });
      }
    } catch {
      return res.status(400).json({ error: "Format de date de naissance incorrect." });
    }

    return res.json({ 
      success: true, 
      role: 'élève', 
      message: "Validation d'inscription d'élève réussie côté serveur.",
      signature: "VALIDATED-STUDENT-API" 
    });
  });

  app.post("/api/auth/register/parent", (req, res) => {
    const { nom, prenom, email, password, confirmPassword, telephone, dateNaissance, lieuNaissance } = req.body;

    if (!nom || !prenom || !email || !password || !confirmPassword || !telephone || !dateNaissance || !lieuNaissance) {
      return res.status(400).json({ error: "Tous les champs obligatoires du tuteur/parent doivent être correctement renseignés (Nom, Prénom, Téléphone, Date et Lieu de naissance, Email, Mots de passe)." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "La confirmation du mot de passe de tuteur ne correspond pas." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe du parent doit avoir une longueur d'au moins 6 caractères." });
    }

    // Age validation
    try {
      const birthDateObj = new Date(dateNaissance);
      const age = new Date().getFullYear() - birthDateObj.getFullYear();
      if (age < 18) {
        return res.status(400).json({ error: "Les comptes Parents sont réservés aux majeurs d'au moins 18 ans." });
      }
    } catch {
      return res.status(400).json({ error: "Format de date de naissance incorrect." });
    }

    return res.json({ 
      success: true, 
      role: 'parent', 
      message: "Validation d'inscription parent réussie côté serveur.",
      signature: "VALIDATED-PARENT-API" 
    });
  });

  app.post("/api/auth/register/teacher", (req, res) => {
    const { nom, prenom, email, password, confirmPassword, matricule, dateNaissance, lieuNaissance } = req.body;

    if (!nom || !prenom || !email || !password || !confirmPassword || !matricule || !dateNaissance || !lieuNaissance) {
      return res.status(400).json({ error: "Tous les champs de l'enseignant sont obligatoires (Nom, Prénom, Matricule Enseignant, Date et Lieu de naissance, Email, Mot de passe)." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Les mots de passe saisis pour l'enseignant ne concordent pas." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe de l'enseignant doit contenir au moins 6 caractères de sécurité." });
    }

    // Age validation
    try {
      const birthDateObj = new Date(dateNaissance);
      const age = new Date().getFullYear() - birthDateObj.getFullYear();
      if (age < 18) {
        return res.status(400).json({ error: "L'enseignant doit avoir au moins 18 ans à l'inscription." });
      }
    } catch {
      return res.status(400).json({ error: "Date de naissance invalide." });
    }

    return res.json({ 
      success: true, 
      role: 'enseignant', 
      message: "Validation d'inscription enseignant réussie côté serveur.",
      signature: "VALIDATED-TEACHER-API" 
    });
  });

  app.post("/api/auth/register/staff", (req, res) => {
    const { nom, prenom, email, password, confirmPassword, matricule, dateNaissance, lieuNaissance, position } = req.body;

    if (!nom || !prenom || !email || !password || !confirmPassword || !matricule || !dateNaissance || !lieuNaissance || !position) {
      return res.status(400).json({ error: "Tous les champs de l'agent administratif sont obligatoires (Nom, Prénom, Matricule, Fonction désignée, Date et Lieu de naissance, Email, Mot de passe)." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Les mots de passe du personnel administratif sont différents." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Sécurité insuffisante : le mot de passe requis doit être de 6 caractères de long minimum." });
    }

    // Age validation
    try {
      const birthDateObj = new Date(dateNaissance);
      const age = new Date().getFullYear() - birthDateObj.getFullYear();
      if (age < 18) {
        return res.status(400).json({ error: "Le personnel administratif doit être âgé de minimum 18 ans." });
      }
    } catch {
      return res.status(400).json({ error: "Date de naissance invalide." });
    }

    return res.json({ 
      success: true, 
      role: 'personnel administratif', 
      message: "Validation d'inscription personnel de l'académie réussie côté serveur.",
      signature: "VALIDATED-STAFF-API" 
    });
  });

  // API routes go here FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
