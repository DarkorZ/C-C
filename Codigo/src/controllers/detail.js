const pool = require('../database');
const PDFDocument = require('pdfkit');

module.exports = {

    getAllBuy: async (req, res) => {
        try {
            const userId = req.user.PERSONA_ID;
            const detail = await pool.query('SELECT * FROM VENTA WHERE PERSONA_ID = ?', [userId]);
            res.render('detail/buy', { detail });
        } catch (error) {
            console.error("Error en getAllBuy:", error);
            res.status(500).send("Error interno del servidor");
        }
    },

    getDetailBuy: async (req, res) => {
        try {
            const { VENTA_ID } = req.params;

            // Obtener detalles de la compra
            const detailBuy = await pool.query(`
                SELECT 
                    DV.*, P.PRODUCTO_NOMBRE, 
                    PR.PERSONA_NOMBRE AS PRODUCTOR_NOMBRE, 
                    PR.PERSONA_TELEFONO AS PRODUCTOR_TELEFONO, 
                    D.PARROQUIA 
                FROM DETALLE_VENTA DV
                LEFT JOIN PRODUCTO P ON DV.PRODUCTO_ID = P.PRODUCTO_ID
                LEFT JOIN PERSONA PR ON DV.DETALLE_PRODUCTOR = PR.PERSONA_ID
                LEFT JOIN DIRECCION D ON DV.DETALLE_DIRECCION = D.DIRECCION_ID
                WHERE DV.VENTA_ID = ?`, [VENTA_ID]);

            // Si no hay detalles de compra, evitar error
            const detailTotal = detailBuy.length > 0 ? detailBuy[0] : { VENTA_TOTAL: "N/A", VENTA_FECHA: "N/A" };

            // Obtener el método de pago
            const pago = await pool.query(`
                SELECT TIPO_PAGO.PAGO_NOMBRE 
                FROM VENTA 
                LEFT JOIN TIPO_PAGO ON VENTA.PAGO_ID = TIPO_PAGO.PAGO_ID 
                WHERE VENTA.VENTA_ID = ?`, [VENTA_ID]);
            const detailPay = pago.length > 0 ? pago[0] : { PAGO_NOMBRE: "N/A" };

            // Obtener datos del usuario
            const { PERSONA_ID } = req.user;
            const rows = await pool.query(`
                SELECT P.PERSONA_NOMBRE, P.PERSONA_TELEFONO, D.PARROQUIA 
                FROM PERSONA P 
                LEFT JOIN DIRECCION D ON P.DIRECCION_ID = D.DIRECCION_ID 
                WHERE P.PERSONA_ID = ?`, [PERSONA_ID]);
            const profile = rows.length > 0 ? rows[0] : { PERSONA_NOMBRE: "N/A", PERSONA_TELEFONO: "N/A", PARROQUIA: "N/A" };

            // Crear documento PDF
            const doc = new PDFDocument();
            const filename = encodeURIComponent(`compra_${VENTA_ID}.pdf`);

            res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-type', 'application/pdf');

            // Cabecera
            doc.fillColor("#444444")
                .fontSize(20).text("Red De Profesionales De Cotopaxi", 50, 57)
                .fontSize(10).font("Helvetica-Bold").text("Fecha de compra:", 400, 65)
                .font("Helvetica").text(detailTotal.VENTA_FECHA, 200, 65, { align: "right" })
                .text("Cotopaxi", 200, 80, { align: "right" });

            doc.moveDown();

            // Datos del cliente
            doc.fillColor("#444444").fontSize(15).text("Datos Personales", 50, 160);
            doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 190).lineTo(550, 190).stroke();

            doc.fontSize(10).font("Helvetica-Bold").text("Nombre:", 50, 200)
                .font("Helvetica").text(profile.PERSONA_NOMBRE, 125, 200)
                .font("Helvetica-Bold").text("Teléfono:", 50, 215)
                .font("Helvetica").text(profile.PERSONA_TELEFONO, 125, 215)
                .font("Helvetica-Bold").text("Dirección:", 50, 230)
                .font("Helvetica").text(profile.PARROQUIA, 125, 230);

            doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 250).lineTo(550, 250).stroke();

            // Detalle de la compra
            doc.fillColor("#444444").fontSize(15).text("Detalle Compra", 50, 300);
            doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 330).lineTo(550, 330).stroke();

            doc.fontSize(10).font("Helvetica-Bold").text("Producto", 50, 340)
                .text("Cantidad", 125, 340).text("Precio", 175, 340).text("Total", 225, 340)
                .text("Productor", 275, 340).text("Teléfono", 375, 340).text("Dirección", 440, 340);

            doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 355).lineTo(550, 355).stroke();

            let invoiceTableBody = 370;

            for (const i of detailBuy) {
                doc.fontSize(10).font("Helvetica")
                    .text(i.PRODUCTO_NOMBRE || "N/A", 50, invoiceTableBody)
                    .text(i.DETALLE_CANTIDAD || "N/A", 125, invoiceTableBody)
                    .text(i.DETALLE_PRECIOUNITARIO || "N/A", 175, invoiceTableBody)
                    .text(i.DETALLE_PRECIOTOTAL || "N/A", 225, invoiceTableBody)
                    .text(i.PRODUCTOR_NOMBRE || "N/A", 275, invoiceTableBody)
                    .text(i.PRODUCTOR_TELEFONO || "N/A", 375, invoiceTableBody)
                    .text(i.PARROQUIA || "N/A", 440, invoiceTableBody);

                doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, invoiceTableBody + 15).lineTo(550, invoiceTableBody + 15).stroke();
                invoiceTableBody += 25;
            }

            // Pie de tabla
            doc.fontSize(10).font("Helvetica-Bold").text("Total:", 160, invoiceTableBody)
                .font("Helvetica").text(detailTotal.VENTA_TOTAL, 225, invoiceTableBody)
                .font("Helvetica-Bold").text("Tipo de pago:", 160, invoiceTableBody + 20)
                .font("Helvetica").text(detailPay.PAGO_NOMBRE, 225, invoiceTableBody + 20);

            doc.pipe(res);
            doc.end();

        } catch (error) {
            console.error("Error en getDetailBuy:", error);
            res.status(500).send("Error generando el PDF");
        }
    },

    getAllSell: async (req, res) => {
        try {
            const userId = req.user.PERSONA_ID;
            const detail = await pool.query('SELECT * FROM VENTA WHERE PERSONA_ID = ?', [userId]);
            res.render('detail/sell', { detail });
        } catch (error) {
            console.error("Error en getAllSell:", error);
            res.status(500).send("Error interno del servidor");
        }
    }

};



/*
const pool = require('../database');

var PDFDocument = require('pdfkit');

module.exports = {

    getAllBuy: async (req, res) => {
        const userId = req.user.PERSONA_ID;
        const detail = await pool.query('SELECT * FROM VENTA WHERE PERSONA_ID = ?', [userId]);
        res.render('detail/buy', { detail });
    },

    getDetailBuy: async (req, res) => {
        const { VENTA_ID } = req.params;
        const detailBuy = await pool.query('SELECT * FROM DETALLE_VENTA LEFT JOIN VENTA ON DETALLE_VENTA.VENTA_ID = VENTA.VENTA_ID LEFT JOIN PRODUCTO ON DETALLE_VENTA.PRODUCTO_ID = PRODUCTO.PRODUCTO_ID LEFT JOIN PERSONA ON DETALLE_VENTA.DETALLE_PRODUCTOR = PERSONA.PERSONA_ID LEFT JOIN DIRECCION ON DETALLE_VENTA.DETALLE_DIRECCION = DIRECCION.DIRECCION_ID WHERE DETALLE_VENTA.VENTA_ID = ?', [VENTA_ID]);
        const detailTotal = detailBuy[0];

        const pago = await pool.query('SELECT * FROM VENTA, TIPO_PAGO WHERE VENTA.PAGO_ID = TIPO_PAGO.PAGO_ID AND VENTA.VENTA_ID = ?', [VENTA_ID]);
        const detailPay = pago[0];

        const { PERSONA_ID } = req.user;
        const rows = await pool.query('SELECT * FROM PERSONA, DIRECCION WHERE PERSONA.DIRECCION_ID = DIRECCION.DIRECCION_ID AND PERSONA.PERSONA_ID = ?', [PERSONA_ID]);
        const profile = rows[0];

        const doc = new PDFDocument();

        var filename = encodeURIComponent(Math.random()) + '.pdf';
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        //Header
        doc
            .fillColor("#444444")
            .fontSize(20)
            .text("Red De Profesionales De Cotopaxi", 50, 57)
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Fecha de compra:", 400, 65)
            .font("Helvetica")
            .text(detailTotal.VENTA_FECHA, 200, 65, { align: "right" })
            .text("Cotopaxi", 200, 80, { align: "right" })
            .moveDown();

        //body
        doc
            .fillColor("#444444")
            .fontSize(15)
            .text("Datos Personales", 50, 160);

        doc.strokeColor("#aaaaaa")
            .lineWidth(1)
            .moveTo(50, 190)
            .lineTo(550, 190)
            .stroke();

        const customerInformationTop = 200;

        doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Nombre:", 50, customerInformationTop)
            .font("Helvetica")
            .text(profile.PERSONA_NOMBRE, 125, customerInformationTop)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Telefono:", 50, customerInformationTop + 15)
            .font("Helvetica")
            .text(profile.PERSONA_TELEFONO, 125, customerInformationTop + 15)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Dirección:", 50, customerInformationTop + 30)
            .font("Helvetica")
            .text(profile.PARROQUIA, 125, customerInformationTop + 30)

            .moveDown();

        doc.strokeColor("#aaaaaa")
            .lineWidth(1)
            .moveTo(50, 250)
            .lineTo(550, 250)
            .stroke();


        doc
            .fillColor("#444444")
            .fontSize(15)
            .text("Detalle Compra", 50, 300);

        //Head Table
        let invoiceTableHead = 330;

        doc.strokeColor("#aaaaaa")
            .lineWidth(1)
            .moveTo(50, invoiceTableHead + 10)
            .lineTo(550, invoiceTableHead + 10)
            .stroke();

        doc

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Producto", 50, invoiceTableHead + 20)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Cantidad", 125, invoiceTableHead + 20)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Precio", 175, invoiceTableHead + 20)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Total", 225, invoiceTableHead + 20)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Productor", 275, invoiceTableHead + 20)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Telefono", 375, invoiceTableHead + 20)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Direccion", 440, invoiceTableHead + 20)

            .moveDown();


        doc.strokeColor("#aaaaaa")
            .lineWidth(1)
            .moveTo(50, invoiceTableHead + 35)
            .lineTo(550, invoiceTableHead + 35)
            .stroke();

        //Table        
        let invoiceTableBody = 380;

        for (const i of detailBuy) {
            doc
                .fontSize(10)
                .font("Helvetica")
                .text(i.DETALLE_NOMBREPRODUCTO, 50, invoiceTableBody)

                .fontSize(10)
                .font("Helvetica")
                .text(i.DETALLE_CANTIDAD, 125, invoiceTableBody)

                .fontSize(10)
                .font("Helvetica")
                .text(i.DETALLE_PRECIOUNITARIO, 175, invoiceTableBody)

                .fontSize(10)
                .font("Helvetica")
                .text(i.DETALLE_PRECIOTOTAL, 225, invoiceTableBody)

                .fontSize(10)
                .font("Helvetica")
                .text(i.PERSONA_NOMBRE, 275, invoiceTableBody)

                .fontSize(10)
                .font("Helvetica")
                .text(i.PERSONA_TELEFONO, 375, invoiceTableBody)

                .fontSize(10)
                .font("Helvetica")
                .text(i.PARROQUIA, 440, invoiceTableBody)

            doc.strokeColor("#aaaaaa")
                .lineWidth(1)
                .moveTo(50, invoiceTableBody + 15)
                .lineTo(550, invoiceTableBody + 15)
                .stroke();

            invoiceTableBody = invoiceTableBody + 25;
            console.log('position body: ' + invoiceTableBody);
        }

        // Table foot
        doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Total:", 160, invoiceTableBody)

            .fontSize(10)
            .font("Helvetica")
            .text(detailTotal.VENTA_TOTAL, 225, invoiceTableBody)

            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Tipo de pago:", 160, invoiceTableBody + 20)

            .fontSize(10)
            .font("Helvetica")
            .text(detailPay.PAGO_NOMBRE, 225, invoiceTableBody + 20)

        doc.pipe(res);
        doc.end();

    },

    getAllSell: async (req, res) => {
        const userId = req.user.PERSONA_ID;
        const detail = await pool.query('SELECT * FROM PERSONA, DETALLE_VENTA, VENTA, PRODUCTO, TIPO_PAGO WHERE VENTA.PERSONA_ID = PERSONA.PERSONA_ID AND VENTA.VENTA_ID = DETALLE_VENTA.VENTA_ID AND DETALLE_VENTA.PRODUCTO_ID = PRODUCTO.PRODUCTO_ID AND VENTA.PAGO_ID = TIPO_PAGO.PAGO_ID AND DETALLE_VENTA.DETALLE_PRODUCTOR = ?', [userId]);
        res.render('detail/sell', { detail });
    }

}

*/