require('dotenv').config();

const express = require('express');
const swaggerJsDoc=require('swagger-jsdoc');
const swaggerUi=require('swagger-ui-express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto=require('crypto');

const app = express();
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.serialize(()=>{
    db.run("CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, short_url TEXT, original_url TEXT,visit INTEGER)");
});

const port = process.env.PORT || 8080;

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
    db.get("SELECT COUNT(original_url) AS count FROM urls ",(err,row)=>{
        if(err){
            res.status(500).json({message:'Erreur base de donnée',error:err.message});
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
        return res.json({ linkCount: row.count });
    });
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
  const url = req.body.url;
  if(!url){
    return res.status(400).json({ message: 'URL requise.' });
  }

  db.get("SELECT * FROM urls WHERE original_url=?",[url],(err,row)=>{
    if(err){
        res.status(500).json({message:'Erreur serveur',error:err.message});
    }

    if(row){
        const newVisitCount=row.visit+1;
        db.run("UPDATE urls SET visit=? WHERE short_url=?",[newVisitCount,row.short_url],(err)=>{
            if(err){
                res.status(500).json({message:'erreur mise à jour'});
            }else{
                res.json({ message: `${url}`,visit:newVisitCount, short_url: row.short_url });
                
            }
        });
    }else{
        const short_url=crypto.randomBytes(3).toString('hex'); 

        db.run('INSERT INTO urls (short_url, original_url, visit) VALUES (?, ?, ?)', [short_url, url, 1], (err) => {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de l\'insertion de l\'URL', error: err.message });
          }
          // Renvoie un message indiquant que l'URL a été ajoutée
          return res.json({ message: `Url ajoutée : ${short_url}`, visit: 1 });
        });
    }
  });
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
 *                   example: "Url:nomurl"
 */
app.get('/:url', (req, res) => {
    const short_url=req.params.url;

    db.get("SELECT * FROM urls WHERE short_url=?",[short_url],(err,row)=>{
        if(err){
            return res.status(500).json({ message: 'Erreur serveur', error: err.message });
        }
        if(row){
            const newVisitCount = row.visit + 1;
            db.run("UPDATE urls SET visit=? WHERE short_url=?", [newVisitCount, short_url], (err) => {
              if (err) {
                return res.status(500).json({ message: 'Erreur lors de la mise à jour des visites', error: err.message });
              }
              return res.redirect(row.original_url);
            });
        }else{
            return res.status(404).json({message:"Pas d'Url trouvée"})
        }
    })
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
    const short_url = req.params.url;
    db.get('SELECT original_url,created_at,visit FROM urls WHERE short_url=?',[url],async (err,row)=>{
        if(err){
            return res.status(500).json({ message: 'Erreur serveur', error: err.message });
        }
        if(!row){
            return res.status(404).json({ message: 'URL raccourchie non trouvée.' });
        }
        try{
            const response = await axios.get(row.original_url);
            return res.json({
                original_url: row.original_url,
                created_at: row.created_at,
                visit: row.visit,
                message: `L'URL est accessible`,
                status: response.status
            });
        }
        catch(error){
            return res.status(400).json({ message: "Impossible d'accéder à l'URL", error: error.message });
        }
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
