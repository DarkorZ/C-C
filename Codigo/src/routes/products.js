// const express = require('express');
// const router = express.Router();

const { Router } = require('express');
const router = Router();
const multer = require('multer');
const { isLoggedIn } = require('../lib/auth');
const storage = multer.memoryStorage(); // Para leer archivos sin guardarlos en disco
const upload = multer({ storage: storage, limits: { fileSize: 10*1024*1024 } }); // Limitar tamaño de archivo a 1MB

const {
    getAllProducts,
    createProductPage,
    createProductPost,
    deleteProduct,
    deleteOffert,
    editProductPage,
    editProductPost,
    editPeoplePage,
    editPeoplePost,
    importProductsFromExcel,
    cycPage,
    getProductsWithLowStock,
} = require('../controllers/products');
router.get('/cyc', isLoggedIn, cycPage)
router.post('/cyc', upload.single('archivo'), isLoggedIn, importProductsFromExcel);
router.get('/add', isLoggedIn, createProductPage);
router.post('/add', isLoggedIn, createProductPost);
router.get('/', isLoggedIn, getAllProducts);
router.get('/delete/:producto_id', isLoggedIn, deleteProduct);
router.get('/deleteoffer/:producto_id', isLoggedIn, deleteOffert);
router.get('/edit/:producto_id', isLoggedIn, editProductPage);
router.post('/edit/:producto_id', isLoggedIn, editProductPost);
router.get('/lowStockList', isLoggedIn, getProductsWithLowStock);


// Editar Persona
router.get('/user', isLoggedIn, editPeoplePage);
router.post('/user', isLoggedIn, editPeoplePost);

module.exports = router;