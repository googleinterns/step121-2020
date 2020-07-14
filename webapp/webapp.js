const express = require('express');
const path = require('path');
const app = new express();
const port = 8080;

app.use(express.static(__dirname));

app.get('/', (req, res) => res.redirect('../html/createSession.html'));

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));