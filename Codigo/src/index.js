const express = require('express');
const morgan = require('morgan');
const path = require('path');
const exphbs = require('express-handlebars');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const MySQLStore = require('express-mysql-session')(session);
const multer = require('multer');

const { database } = require('./keys');

// Initializations
const app = express();
require('./lib/passport');

// Settings
app.set('port', process.env.PORT || 3004);
app.set('views', path.join(__dirname, 'views'));

app.engine('.hbs', exphbs({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs',
    helpers: require('./lib/handlebars')
}));
app.set('view engine', '.hbs');

// Middlewares
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'tienda virtual',
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore(database)
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Configuración de multer para archivos Excel
const storage = multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
            file.mimetype !== "application/vnd.ms-excel") {
            return cb(new Error('Error: Solo se permiten archivos Excel (.xlsx, .xls)'));
        }
        cb(null, true);
    }
});

app.use(upload.single('archivo'));

// Global Variables
app.use((req, res, next) => {
    app.locals.success = req.flash('success');
    app.locals.message = req.flash('message');
    app.locals.user = req.user;
    next();
});

// Routes
app.use(require('./routes/index'));
app.use(require('./routes/authentication'));
app.use(require('./routes/about'));
app.use(require('./routes/store'));
app.use('/administrator', require('./routes/administrator'));
app.use('/products', require('./routes/products'));
app.use('/detail', require('./routes/detail'));

// Public
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.status(404).send('Page Not Found (Página no encontrada)');
});

app.use((req, res, next) => {
    res.status(500).send('Something Broke! (Algo salió mal)');
});

// Starting the server
app.listen(app.get('port'), () => {
    console.log('Server on port', app.get('port'));
});
