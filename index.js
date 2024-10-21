require('dotenv').config();

const express = require('express');
const swaggerJsDoc=require('swagger-jsdoc');
const swaggerUi=require('swagger-ui-express');


const app = express();

const sqlite3 = require('sqlite3').verbose();
const db= new sqlite3.Database(process.env.DB_FILE);

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

db.serialize(()=>{
    db.run("CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, short_url TEXT, original_url TEXT)");
});

const port = process.env.PORT || 3000;

// Middleware pour parser le corps des requêtes en JSON
app.use(express.json());

/**
 * @swagger
 * /:
 *   get:
 *     summary: "Bienvenue à l'API V1"
 *     description: "Renvoie un message de bienvenue."
 *     responses:
 *       200:
 *         description: "Succès"
 */

app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue à l\'API V1!' });
});

/**
 * @swagger
 * /:
 *   post:
 *     summary: "Envoie de données"
 *     description: "Renvoie un message 'Données reçues!'."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *     responses:
 *       200:
 *         description: "Données reçues"
 */

app.post('/', (req, res) => {
  const data = req.body;
  res.json({ message: 'Données reçues!', data });
});

/**
 * @swagger
 * /error:
 *   get:
 *     summary: "Erreur simulée"
 *     description: "Simulation d'erreur 500 pour les tests."
 *     responses:
 *       500:
 *         description: "Erreur interne du serveur"
 */

app.get('/error', (req, res) => {
  throw new Error('Erreur 500 simulée pour les tests.');
});

// Route GET /:url

/**
 * @swagger
 * /{url}:
 *   get:
 *     summary: "Information sur une URL"
 *     description: "Renvoie des informations sur une URL donnée."
 *     parameters:
 *       - name: url
 *         in: path
 *         required: true
 *         description: "L'URL pour laquelle demander des informations."
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Informations demandées avec succès"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Vous avez demandé des infos pour : example.com"
 */
app.get('/:url', (req, res) => {
  const url = req.params.url;
  res.json({ message: `Vous avez demandé des infos pour : ${url}` });
});


// Route GET /status/:url
/**
 * @swagger
 * /status/{url}:
 *   get:
 *     summary: "Vérifier l'accessibilité d'une URL"
 *     description: "Renvoie le statut d'une URL donnée en effectuant une requête HTTP."
 *     parameters:
 *       - name: url
 *         in: path
 *         required: true
 *         description: "L'URL à vérifier."
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "L'URL est accessible"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "L'URL est accessible"
 *                 status:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: "Impossible d'accéder à l'URL"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Impossible d'accéder à l'URL"
 *                 error:
 *                   type: string
 *                   example: "ECONNREFUSED"
 */
app.get('/status/:url', async (req, res) => {
  const url = req.params.url;

  try {
    const response = await axios.get(`http://${url}`);
    res.json({ message: `L'URL est accessible`, status: response.status });
  } catch (error) {
    res.status(400).json({ message: `Impossible d'accéder à l'URL`, error: error.message });
  }
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
