const express = require('express'); 
require('dotenv').config(); 
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// mysql 
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10
});

app.use(cors());
app.use('/static', express.static(path.join(__dirname, 'static')));

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// 이름 정제 
function cleanNm(locationNm) {
    if (!locationNm) return "";
    let lc_name = locationNm.split('(')[0].replace(/:/g, "").trim();
    if (!(lc_name.endsWith("역") || lc_name.endsWith("센터"))) lc_name += "역";
    return lc_name;
}

// 유실물 센터 위치
const stationToCenter = {
    "시청역": "시청유실물센터",
    "충무로역": "충무로유실물센터",
    "왕십리역": "왕십리유실물센터",
    "태릉입구역": "태릉유실물센터",
    "종합운동장역": "종합운동장유실물센터"
};

// 장소로 검색
app.get('/location/:name', async (req, res) => {
    // 입력 데이터 정제
    const stationNm = cleanNm(req.params.name);
    const centerNm = stationToCenter[stationNm] || stationNm;

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    console.log(`[검색 요청] 장소명: ${stationNm}, ${centerNm}, 페이지: ${page}, 오프셋: ${offset}`);

    try {
        // stationNm으로 시작하거나 centerNm으로 시작하는 데이터만 조회
        const whereClause = "WHERE depPlace LIKE ? OR depPlace LIKE ?";

        const queryParams = [`${stationNm}%`, `${centerNm}%`];
        const [rows] = await pool.query(
            `SELECT * FROM keeping_items 
   ${whereClause} 
   ORDER BY fdymd DESC LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        console.log(`습득물 개수: ${rows.length}개`);

        const [totalRows] = await pool.query(
            `SELECT COUNT(*) as total FROM keeping_items ${whereClause}`,
            queryParams
        );

        const totalItems = totalRows[0].total;
        console.log(`전체 검색 결과 개수: ${totalItems}개`);
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            items: rows,
            totalPages: totalPages,
            totalItems: totalItems,
            currentPage: page
        });

    } catch (err) {
        console.error(`[DB Error] ${err.message}`); 
        
        res.status(500).json({ 
            error: "잠시 후 다시 시도해주세요." 
        });
    }
});

// 물품명 or 장소명 으로 검색
app.get('/item/:name', async (req, res) => {
    const itemName = req.params.name;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
        // 데이터 조회 
        const [rows] = await pool.query(
            "SELECT * FROM keeping_items WHERE fdPrdtNm LIKE ? OR depPlace LIKE ? ORDER BY fdymd DESC LIMIT ? OFFSET ?",
            [`%${itemName}%`, `%${itemName}%`, limit, offset]
        );

        // 전체 개수 조회
        const [totalRows] = await pool.query(
            "SELECT COUNT(*) as total FROM keeping_items WHERE fdPrdtNm LIKE ? OR depPlace LIKE ?",
            [`%${itemName}%`, `%${itemName}%`]
        );

        res.json({
            items: rows,
            totalPages: Math.ceil(totalRows[0].total / limit),
            totalItems: totalRows[0].total, 
            currentPage: page
            });

    } catch (err) {
        console.error(`[DB Error] ${err.message}`); 
        
        res.status(500).json({ 
            error: "잠시 후 다시 시도해주세요." 
        });
    }
});


app.listen(port, () => console.log(`Server running at http://localhost:${port}`));