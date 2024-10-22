require('dotenv').config();

const express = require('express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
const db = new sqlite3.Database(process.env.DB_FILE);

// Configuration de Swagger
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0',
            description: 'Documentation de l\'API',
        },
    },
    apis: ['./index.js'], // Chemin vers tes fichiers de routes (à adapter)
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, short_url TEXT, original_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, visit INTEGER)");
});

const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    db.get("SELECT COUNT(original_url) AS count FROM urls", (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Erreur base de donnée', error: err.message });
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});


// Route pour supprimer un lien
app.delete("/api/link/:id", (req, res) => {
    const id = req.params.id;

    db.run("DELETE FROM urls WHERE id = ?", id, function (err) {
        if (err) {
            return res.status(500).json({ status: "ERROR", message: 'Erreur lors de la suppression du lien', error: err.message });
        }
        return res.status(200).json({ status: "SUCCESS", message: 'Lien supprimé avec succès.' });
    });
});


app.post('/', (req, res) => {
    const url = req.body.url;
    if (!url) {
        return res.status(400).json({ message: 'URL requise.' });
    }

    db.get("SELECT * FROM urls WHERE original_url=?", [url], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Erreur serveur', error: err.message });
        }

        if (row) {
            db.get('SELECT COUNT(*) AS nb FROM urls', (err, countRow) => {
                if (err) {
                    return res.status(404).json({ message: 'erreur' });
                }
                return res.json({
                    message: `${url}`,
                    short_url: row.short_url,
                    visit: countRow.nb
                });
            });
            return;
        }

        const short_url = crypto.randomBytes(3).toString('hex');

        db.run('INSERT INTO urls (short_url, original_url, visit) VALUES (?, ?, ?)', [short_url, url, 1], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erreur lors de l\'insertion de l\'URL', error: err.message });
            }
            db.get('SELECT COUNT(*) AS nb FROM urls', (err, countRow) => {
                if (err) {
                    return res.status(404).json({ message: 'erreur' });
                }
                return res.json({
                    message: `${url}`,
                    short_url,
                    visit: countRow.nb
                });
            });
        });
    });
});

// Route pour récupérer les liens
app.get("/api/liens", (req, res, next) => {
    const query = "SELECT * FROM urls";

    db.all(query, [], (err, lignes) => {
        if (err) {
            console.error("Erreur lors de l'exécution de la requête:", err);
            return next(err);
        }
        return res.status(200).json({ status: "SUCCESS", links: lignes });
    });
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur' });
});

// Lancement du serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
