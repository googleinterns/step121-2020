const express = require('express');
const path = require('path');
const app = new express();


//In order to get all of the project files
app.use(express.static(path.join(__dirname, 'webapp')));

//Get HTML page
app.get('/', (req, res) => res.redirect('participants.html'));

// Start the server on port 3000
app.listen(8080, () => console.log('Node server running on port 8080'));
