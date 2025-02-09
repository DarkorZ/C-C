const pool = require('../database');

const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: 'drwpai0vu',
    api_key: '942431336444345',
    api_secret: '2F20lvuOg14-P-2zBCqBZsY8S20'
});

const fs = require('fs-extra');
const xlsx = require('xlsx');

module.exports = {
    importProductsFromExcel: async (req, res) => {
        try {
            console.log('📂 Archivo recibido:', req.file);
            
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
            }

            console.log('📑 Tipo de archivo:', req.file.mimetype);
            console.log('📏 Tamaño del archivo:', req.file.size, 'bytes');
            console.log('🔍 Verificando el contenido de req.file:', req.file);

            let workbook; // 🔹 Declarar workbook antes del try

            try {
                const fileBuffer = fs.readFileSync(req.file.path); // Leer archivo desde el path
                console.log('📂 Archivo leído desde el sistema de archivos con éxito.');

                workbook = xlsx.read(fileBuffer, { type: 'buffer' }); // Convertir a formato de Excel
                console.log('📊 Hojas disponibles en el archivo:', workbook.SheetNames);

            } catch (error) {
                console.error('❌ Error al procesar el archivo:', error.message);
                return res.status(500).json({ success: false, message: 'Error al leer el archivo Excel' });
            }

            if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                console.error('❌ ERROR: El archivo no contiene hojas válidas');
                return res.status(400).json({ success: false, message: 'El archivo Excel no tiene hojas válidas' });
            }

            const sheetName = workbook.SheetNames[0]; // Tomamos la primera hoja
            const sheet = workbook.Sheets[sheetName];

            if (!sheet) {
                console.error('❌ ERROR: No se pudo acceder a la hoja del archivo');
                return res.status(400).json({ success: false, message: 'El archivo Excel no tiene hojas válidas' });
            }

            console.log(`📃 Leyendo datos de la hoja: ${sheetName}`);

            // Extraer datos con encabezados originales
            const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            console.log('🔍 Datos crudos extraídos:', rawData);

            if (!rawData || rawData.length === 0) {
                console.error('❌ ERROR: No se encontraron datos en el archivo');
                return res.status(400).json({ success: false, message: 'El archivo Excel está vacío' });
            }

            if (!rawData[0] || !Array.isArray(rawData[0])) {
                console.error('❌ ERROR: El archivo Excel no contiene encabezados válidos');
                return res.status(400).json({ success: false, message: 'El archivo Excel no contiene encabezados válidos' });
            }

            // Normalizar los nombres de las columnas
            const headers = rawData[0].map(header =>
                header ? header.toString().trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') : 'ColumnaDesconocida'
            );

            console.log('🔄 Encabezados normalizados:', headers);

            // Convertir el resto de las filas en objetos con claves normalizadas
            const productsData = rawData.slice(1).map(row => {
                let obj = {};
                headers.forEach((key, index) => {
                    obj[key] = row[index] !== undefined ? row[index] : null;
                });
                return obj;
            });

            console.log('📋 Datos normalizados:', JSON.stringify(productsData, null, 2));

            if (productsData.length === 0) {
                console.error('❌ ERROR: No se encontraron filas de datos');
                return res.status(400).json({ success: false, message: 'El archivo Excel no contiene datos válidos' });
            }

            let insertedCount = 0;

            for (const row of productsData) {
                if (!row.CodigoProducto || !row.Descripcion) {
                    console.error('❌ Producto con datos inválidos:', row);
                    continue;
                }

                const newProduct = {
                    CodigoProducto: row.CodigoProducto ? row.CodigoProducto.toString() : 'SIN CODIGO',
                    Descripcion: row.Descripcion || 'SIN DESCRIPCION',
                    Linea: row.Linea || 'SIN LINEA',
                    Subcategoria: row.Subcategoria || 'SIN SUBCATEGORIA',
                    TotalExistencias: row.TotalExistencias ? parseInt(row.TotalExistencias, 10) : 0,
                    Precio1: row.Precio1 ? parseFloat(row.Precio1) : 0.0,
                    Precio2: row.Precio2 ? parseFloat(row.Precio2) : 0.0,
                    CostoActual: row.CostoActual ? parseFloat(row.CostoActual) : 0.0,
                    CostoUltimaCompra: row.CostoUltimaCompra ? parseFloat(row.CostoUltimaCompra) : 0.0,
                    CostoVenta: row.CostoVenta ? parseFloat(row.CostoVenta) : 0.0,
                    IVA: row.IVA ? parseFloat(row.IVA.toString().replace('%', '')) / 100 : 0.0
                };

                console.log('✅ Producto formateado:', newProduct);


              try {
                    // Verificar si el producto ya existe antes de insertarlo
                    const [existingProduct] = await pool.query('SELECT COUNT(*) AS count FROM cycproducto WHERE CodigoProducto = ?', [newProduct.CodigoProducto]);

                    if (existingProduct.count > 0) {
                        console.log('⚠️ Producto ya existe, se omitirá:', newProduct.CodigoProducto);
                        continue; // Omitir si ya existe
                    }

                    // Insertar solo si no existe
                    await pool.query('INSERT INTO cycproducto SET ?', [newProduct]);
                    insertedCount++;
                } catch (sqlError) {
                    console.error("❌ Error SQL al insertar producto:", sqlError.sqlMessage || sqlError.message);
                }
            }

            res.render('products/cyc', {
                success: true,
                message: `Productos importados correctamente: ${insertedCount} registros insertados`
            });

        } catch (error) {
            console.error('❌ Error al procesar el archivo:', error.message);
            res.status(500).json({ success: false, message: 'Error al importar productos' });
        }
    },

    cycPage: async (req, res) => {
        res.render('products/cyc');
    },

    getProductsWithLowStock: async (req, res) => {
        try {
            // Consulta para obtener productos con TotalExistencias <= 0
            const products = await pool.query(
                `SELECT * 
                 FROM cycproducto 
                 WHERE TotalExistencias <= 0
                 ORDER BY Linea ASC`
            );
            
            // Renderizar la vista con los productos
            res.render('products/lowStockList', { products });
        } catch (error) {
            console.error('Error al obtener los productos con bajo stock:', error);
            res.status(500).json({ success: false, message: 'Error al obtener los productos con bajo stock' });
        }
    },



    getAllProducts: async (req, res) => {
        try {
            // Obtener productos con TotalExistencias negativo o 0 desde la tabla cycproducto
            const products = await pool.query(
                `SELECT * 
                FROM cycproducto 
                WHERE TotalExistencias <= 0`
            );
    
            // Renderizar la vista con los productos
            res.render('products/list', { products });
        } catch (error) {
            console.error('Error al obtener los productos:', error);
            res.status(500).json({ success: false, message: 'Error al obtener los productos' });
        }
    },
    createProductPage: async (req, res) => {
        try {
            // Obtener productos con TotalExistencias negativo o 0 desde la tabla cycproducto
            const products = await pool.query(
                `SELECT *  FROM cycproducto WHERE TotalExistencias <= 0`
            );
    
            // Obtener otras tablas necesarias para el formulario
            const category = await pool.query('SELECT * FROM Subcategoria');
            const presentation = await pool.query('SELECT * FROM Descripcion');
            const measure = await pool.query('SELECT * FROM Linea');
    
            // Renderizar la vista con los productos y las opciones de categorías, presentaciones y medidas
            res.render('products/add', { products, category, presentation, measure });
        } catch (error) {
            console.error('Error al cargar la página de creación de productos:', error);
            res.status(500).json({ success: false, message: 'Error al cargar la página de creación de productos' });
        }
    },
    

    createProductPost: async (req, res) => {
        console.log(req.body);
    
        const { CATEGORIA_ID, PRESENTACION_ID, MEDIDA_ID, PRODUCTO_NOMBRE, PRODUCTO_DESCRIPCION, OFERTA_DESCRIPCION, PRODUCTO_CANTIDAD, PRODUCTO_PRECIO, PRODUCTO_MEDIDA, PRODUCTO_FECHAPUBLICACION, PRODUCTO_FECHALIMITE, PRODUCTO_FECHACOCECHA, PRODUCTO_ESTADO, PRODUCTO_IMAGEN, PRODUCTO_URL } = req.body;
    
        // Verificar si el producto ya existe en la base de datos
        const existingProduct = await pool.query(
            `SELECT * FROM cycproducto WHERE CodigoProducto = ?`, 
            [req.body.CodigoProducto]
        );
    
        if (existingProduct.length > 0) {
            req.flash('error', 'El producto con este código ya existe.');
            return res.redirect('/products/cyc');
        }
    
        const newProduct = {
            PERSONA_ID: req.user.PERSONA_ID,
            CATEGORIA_ID,
            PRESENTACION_ID,
            MEDIDA_ID,
            PRODUCTO_NOMBRE,
            PRODUCTO_DESCRIPCION,
            PRODUCTO_CANTIDAD,
            PRODUCTO_PRECIO,
            PRODUCTO_MEDIDA,
            PRODUCTO_FECHAPUBLICACION: new Date(),
            PRODUCTO_FECHALIMITE,
            PRODUCTO_FECHACOCECHA,
            PRODUCTO_ESTADO,
            PRODUCTO_IMAGEN,
            PRODUCTO_URL
        };
    
        newProduct.PRODUCTO_ESTADO = 'Verdadero';
    
        try {
            if (req.file.path) {
                const cloudImage = await cloudinary.uploader.upload(req.file.path); // Permite guardar las imágenes en Cloudinary
                newProduct.PRODUCTO_IMAGEN = cloudImage.public_id;
                newProduct.PRODUCTO_URL = cloudImage.secure_url;
                await fs.unlink(req.file.path); // Elimina las imágenes, para que no queden almacenadas localmente
            }
        } catch {
            const cloudImage = [];
            cloudImage.public_id = 'product_iqxawz.jpg';
            cloudImage.secure_url = 'https://res.cloudinary.com/drwpai0vu/image/upload/v1617070591/product_iqxawz.jpg';
            newProduct.PRODUCTO_IMAGEN = cloudImage.public_id;
            newProduct.PRODUCTO_URL = cloudImage.secure_url;
        }
    
        console.log(newProduct); // Muestra datos del formulario
    
        await pool.query('INSERT INTO cycproducto set ?', [newProduct]); // Inserta el nuevo producto
    
        if (OFERTA_DESCRIPCION) {
            const row = await pool.query(
                'SELECT MAX(PRODUCTO_ID) AS ID FROM cycproducto WHERE PERSONA_ID = ?', 
                [req.user.PERSONA_ID]
            );
            const lastProduct = row[0].ID;
            const newOfert = {
                PRODUCTO_ID: lastProduct,
                OFERTA_DESCRIPCION
            };
            await pool.query('INSERT INTO OFERTA set ?', [newOfert]);
        }
    
        req.flash('success', 'Producto Agregado'); // Almacena el mensaje de éxito
        res.redirect('/products/cyc'); // Redirige a la lista de productos
    },

    deleteProduct: async (req, res) => {
        const { producto_id } = req.params;
        const rows = await pool.query('SELECT * FROM PRODUCTO WHERE PRODUCTO_ID = ?', [producto_id]);
        const products = rows[0];
        if (products.PRODUCTO_IMAGEN !== 'product_iqxawz.jpg') {
            await cloudinary.uploader.destroy(products.PRODUCTO_IMAGEN); //Eliminamos la imagen
        }
        await pool.query('DELETE FROM OFERTA WHERE PRODUCTO_ID = ?', [producto_id]);
        await pool.query('DELETE FROM PRODUCTO WHERE PRODUCTO_ID = ?', [producto_id]);
        req.flash('success', 'Producto Eliminado');
        res.redirect('/products');//redireccionamos a la misma lista products
    },

    deleteOffert: async (req, res) => {
        const { producto_id } = req.params;
        console.log('ID producto oferta: ' + producto_id);
        await pool.query('DELETE FROM OFERTA WHERE PRODUCTO_ID = ?', [producto_id]);
        req.flash('success', 'Producto En Oferta Eliminado');
        res.redirect('/products');//redireccionamos a la misma lista products
    },

    editProductPage: async (req, res) => {
        const { producto_id } = req.params;

        const productsId = await pool.query('SELECT * FROM PRODUCTO WHERE PRODUCTO.PRODUCTO_ID = ?', [producto_id]);

        const products = await pool.query('SELECT * FROM PRODUCTO LEFT JOIN CATEGORIA ON PRODUCTO.CATEGORIA_ID = CATEGORIA.CATEGORIA_ID LEFT JOIN MEDIDA ON PRODUCTO.MEDIDA_ID = MEDIDA.MEDIDA_ID LEFT JOIN PRESENTACION ON PRODUCTO.PRESENTACION_ID = PRESENTACION.PRESENTACION_ID LEFT JOIN OFERTA ON PRODUCTO.PRODUCTO_ID = OFERTA.PRODUCTO_ID WHERE PRODUCTO.PRODUCTO_ID = ?', [producto_id]);

        const category = await pool.query('SELECT * FROM CATEGORIA');

        const listcategory = await pool.query('SELECT * FROM CATEGORIA WHERE CATEGORIA.CATEGORIA_ID NOT IN (SELECT CATEGORIA_ID FROM PRODUCTO WHERE PRODUCTO_ID = ?)', [producto_id]);

        const listpresentation = await pool.query('SELECT * FROM PRESENTACION WHERE PRESENTACION.PRESENTACION_ID NOT IN (SELECT PRESENTACION_ID FROM PRODUCTO WHERE PRODUCTO_ID = ?)', [producto_id]);

        const listmeasure = await pool.query('SELECT * FROM MEDIDA WHERE MEDIDA.MEDIDA_ID NOT IN (SELECT MEDIDA_ID FROM PRODUCTO WHERE PRODUCTO_ID = ?)', [producto_id]);

        res.render('products/edit', { product: products[0], productId: productsId[0], category, listcategory, listpresentation, listmeasure });
    },

    editProductPost: async (req, res) => {
        const { producto_id } = req.params;

        const rows = await pool.query('SELECT * FROM PRODUCTO WHERE PRODUCTO_ID = ?', [producto_id]);
        const products = rows[0];
console.log(products)
        const { CATEGORIA_ID, PRESENTACION_ID, MEDIDA_ID, PRODUCTO_NOMBRE, PRODUCTO_DESCRIPCION, OFERTA_DESCRIPCION, PRODUCTO_CANTIDAD, PRODUCTO_PRECIO, PRODUCTO_MEDIDA, PRODUCTO_FECHAPUBLICACION, PRODUCTO_FECHALIMITE, PRODUCTO_FECHACOCECHA, PRODUCTO_ESTADO, PRODUCTO_IMAGEN, PRODUCTO_URL } = req.body;

        const newProduct = {
            CATEGORIA_ID,
            PRESENTACION_ID,
            MEDIDA_ID,
            PRODUCTO_NOMBRE,
            PRODUCTO_DESCRIPCION,
            PRODUCTO_CANTIDAD,
            PRODUCTO_PRECIO,
            PRODUCTO_MEDIDA,
            PRODUCTO_FECHAPUBLICACION,
            PRODUCTO_FECHALIMITE,
            PRODUCTO_FECHACOCECHA,
            PRODUCTO_ESTADO,
            PRODUCTO_IMAGEN,
            PRODUCTO_URL
        };

        console.log(newProduct);

        try {
            if (req.file.path) {
                console.log('Imagen actual');
                const cloudImage = await cloudinary.uploader.upload(req.file.path); //Permite guardar las imagenes en cloudinary
                newProduct.PRODUCTO_IMAGEN = cloudImage.public_id;
                newProduct.PRODUCTO_URL = cloudImage.secure_url;
                await fs.unlink(req.file.path); //Elimina las imagenes, para que no guarden de manera local
            }
        } catch {
            newProduct.PRODUCTO_IMAGEN = products.PRODUCTO_IMAGEN;
            newProduct.PRODUCTO_URL = products.PRODUCTO_URL;
        }

        newProduct.PRODUCTO_ESTADO = products.PRODUCTO_ESTADO;
        newProduct.PRODUCTO_FECHAPUBLICACION = products.PRODUCTO_FECHAPUBLICACION;
        newProduct.PRODUCTO_FECHACOCECHA = products.PRODUCTO_FECHACOCECHA
        newProduct.PRODUCTO_FECHALIMITE = products.PRODUCTO_FECHALIMITE;

        console.log(newProduct);

        const find = await pool.query('SELECT * FROM OFERTA WHERE PRODUCTO_ID = ?', [producto_id]);

        if (find.length > 0 && OFERTA_DESCRIPCION) {
            console.log('Hacemos un update');
            await pool.query('UPDATE OFERTA SET OFERTA_DESCRIPCION = ? WHERE OFERTA.PRODUCTO_ID = ?', [OFERTA_DESCRIPCION, producto_id]);

        } else if (find.length == 0 && OFERTA_DESCRIPCION) {
            console.log('Hacemos un insert');
            const newOfert = {
                PRODUCTO_ID: producto_id,
                OFERTA_DESCRIPCION
            };
            console.log(newOfert);
            await pool.query('INSERT INTO OFERTA set ?', [newOfert]);

        } 
        // else if (find.length > 0 && !OFERTA_DESCRIPCION) {
        //     console.log('Hacemos un delete');
        //     await pool.query('DELETE FROM oferta WHERE PRODUCTO_ID = ?', [producto_id]);
        // }

        await pool.query('UPDATE PRODUCTO set ? WHERE PRODUCTO_ID = ?', [newProduct, producto_id]);
        req.flash('success', 'Producto Actualizado');
        res.redirect('/products');
    },

    //
    //
    //
    //

    editPeoplePage: async (req, res) => {
        const people = await pool.query('SELECT * FROM PERSONA, DIRECCION WHERE DIRECCION.DIRECCION_ID = PERSONA.DIRECCION_ID AND PERSONA_ID = ?', [req.user.PERSONA_ID]);

        res.render('products/user', { profile: people[0] });
    },

    editPeoplePost: async (req, res) => {
        console.log(req.body);
        const { PERSONA_ID } = req.user;

        const rows = await pool.query('SELECT * FROM PERSONA WHERE PERSONA_ID = ?', [PERSONA_ID]);
        const profile = rows[0];

        const { DIRECCION_ID, ROL_ID, PERSONA_NOMBRE, PERSONA_TELEFONO, PERSONA_EMAIL, PERSONA_CONTRASENA, PERSONA_ESTADO, PERSONA_LOGIN, PERSONA_IMAGEN, PERSONA_URL } = req.body;

        const newUser = {
            DIRECCION_ID,
            ROL_ID,
            PERSONA_NOMBRE,
            PERSONA_TELEFONO,
            PERSONA_EMAIL,
            PERSONA_CONTRASENA,
            PERSONA_ESTADO,
            PERSONA_LOGIN,
            PERSONA_IMAGEN,
            PERSONA_URL,
        }

        console.log(newUser);

        if (DIRECCION_ID == 0) {
            newUser.DIRECCION_ID = profile.DIRECCION_ID;
        }

        newUser.ROL_ID = profile.ROL_ID;
        newUser.PERSONA_EMAIL = profile.PERSONA_EMAIL;
        newUser.PERSONA_CONTRASENA = profile.PERSONA_CONTRASENA;
        newUser.PERSONA_ESTADO = profile.PERSONA_ESTADO;
        newUser.PERSONA_LOGIN = profile.PERSONA_LOGIN;

        try {
            if (req.file.path) {
                console.log('Imagen actual');
                const cloudImage = await cloudinary.uploader.upload(req.file.path); //Permite guardar las imagenes en cloudinary
                newUser.PERSONA_IMAGEN = cloudImage.public_id;
                newUser.PERSONA_URL = cloudImage.secure_url;
                await fs.unlink(req.file.path); //Elimina las imagenes, para que no guarden de manera local
            }
        } catch {
            newUser.PERSONA_IMAGEN = profile.PERSONA_IMAGEN;
            newUser.PERSONA_URL = profile.PERSONA_URL;
        }

        console.log(newUser);
        await pool.query('UPDATE PERSONA set ? WHERE PERSONA_ID = ?', [newUser, PERSONA_ID]);
        req.flash('success', 'Usuario Modificado');
        res.redirect('/products');
    }

}