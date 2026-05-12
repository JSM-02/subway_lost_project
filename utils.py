# 공통 사용 함수
import requests
import pymysql  
import time
from bs4 import BeautifulSoup
from datetime import datetime
from constants import *
import json


# 지하철역, 유실물센터 정보 파일 로드 함수
def load_location_data(file_pth, name):
    try:
        with open(file_pth, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # key_name에 따라 loctaion_nm 또는 center_nm을 유연하게 추출
        return {clean_location_name(item[name]) for item in data.get('DATA', []) if name in item}
    except Exception as e:
        print(f"파일({file_pth}) 읽기 오류: {e}")
        return set()

# # 지하철 분실물 조회
def fetch_lost_item(target_location_list, start_date):
    all_rows = []
    page = 1
    while True:
        params = {'START_YMD': start_date, 
                  # 'END_YMD' : end_date,
                  'pageNo': page, 
                  'numOfRows': 1000
                  }
        url = f"{BASE_URL}/{SERVICE_1}?serviceKey={API_KEY}"
        res = requests.get(url, params=params, timeout=11)
        soup = BeautifulSoup(res.text, "xml") 
        items = soup.find_all("item")
        if not items: break

        for item in items:
            dep_plc = clean_location_name(item.find('depPlace').text if item.find('depPlace') else "")
            if dep_plc in target_location_list:
                row = {child.name: child.text for child in item.find_all(recursive=False)}
                all_rows.append(row)

        print(f"   -> {page}페이지 검사 중... (누적 {len(all_rows)}건 발견)")
        if len(items) < 100: break
        page += 1
        time.sleep(0.3)
    return all_rows

# 상세정보 조회
def fetch_details(data_list):
    print("상세정보 조회 시작")
    today = datetime.now().strftime('%Y-%m-%d')
    items = [] 
    for item_row in data_list:
        atcId, fdSn = item_row.get('atcId'), item_row.get('fdSn')
        params = {'ATC_ID': atcId, 
                  'FD_SN': fdSn, 
                  'serviceKey': API_KEY
                  }
        try:
            res = requests.get(f"{BASE_URL}/{SERVICE_3}", params=params, timeout=15)
            soup = BeautifulSoup(res.text, "xml") 
            status = soup.find('csteSteNm').text.strip() if soup.find('csteSteNm') else "None"
            
            if status in ["보관중", "반입중", "None"]:
                row_data = {
                    'atcId': atcId, 'fdSn': fdSn, 'csteSteNm': status,
                    'fdPrdtNm': (soup.find('fdPrdtNm').text if soup.find('fdPrdtNm') else item_row.get('fdPrdtNm', "")),
                    'prdtClNm': (soup.find('prdtClNm').text if soup.find('prdtClNm') else item_row.get('prdtClNm', "")),
                    'fdYmd': (soup.find('fdYmd').text if soup.find('fdYmd') else item_row.get('fdYmd', "")),
                    'fdFilePathImg': (soup.find('fdFilePathImg').text if soup.find('fdFilePathImg') else item_row.get('fdFilePathImg', "")),
                    'depPlace': (soup.find('depPlace').text if soup.find('depPlace') else item_row.get('depPlace', "")),
                    'clrNm': item_row.get('clrNm', ""), 'fdSbjt': item_row.get('fdSbjt', ""),
                    'fdHor': (soup.find('fdHor').text if soup.find('fdHor') else ""),
                    'fdPlace': (soup.find('fdPlace').text if soup.find('fdPlace') else ""),
                    'orgNm': (soup.find('orgNm').text if soup.find('orgNm') else ""),
                    'tel': (soup.find('tel').text if soup.find('tel') else ""),
                    'uniq': (soup.find('uniq').text if soup.find('uniq') else ""),
                    'last_update_date': today
                }
                items.append(row_data)
        except Exception as e: print(f"Error {atcId}: {e}")
    return items

# db 연결
def get_db_connection():
    return pymysql.connect(**DB_CONFIG)

# 이름 정제 
def clean_location_name(loctaion_nm):
    if not loctaion_nm: return ""
    loctaion_nm = "".join(loctaion_nm.split())
    loctaion_nm = loctaion_nm.split('(')[0].strip(":").strip() 
    if not (loctaion_nm.endswith("역") or loctaion_nm.endswith("센터")):
        loctaion_nm += "역"
    return loctaion_nm

# DB 저장 
def save_to_db(items):
    if not items: return
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''CREATE TABLE IF NOT EXISTS keeping_items (
        atcId VARCHAR(50) PRIMARY KEY, 
        fdSn VARCHAR(10), 
        fdPrdtNm TEXT, 
        prdtClNm TEXT, 
        fdYmd VARCHAR(20), 
        fdFilePathImg TEXT, 
        depPlace TEXT, 
        clrNm TEXT, 
        fdSbjt TEXT, 
        fdHor TEXT, 
        fdPlace TEXT, 
        csteSteNm VARCHAR(20), 
        orgNm TEXT, 
        tel VARCHAR(50), 
        uniq TEXT, 
        last_update_date VARCHAR(20))''')

    sql = '''INSERT INTO keeping_items VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE 
        fdPrdtNm=VALUES(fdPrdtNm), 
        fdYmd=VALUES(fdYmd), 
        fdFilePathImg=VALUES(fdFilePathImg), 
        csteSteNm=VALUES(csteSteNm),
        fdHor=VALUES(fdHor),
        fdPlace=VALUES(fdPlace),
        tel=VALUES(tel),
        uniq=VALUES(uniq),
        last_update_date=VALUES(last_update_date)'''
    
    for r in items:
        data = (r['atcId'], r['fdSn'], r['fdPrdtNm'], r['prdtClNm'], r['fdYmd'], r['fdFilePathImg'], 
                r['depPlace'], r['clrNm'], r['fdSbjt'], r['fdHor'], r['fdPlace'], r['csteSteNm'], 
                r['orgNm'], r['tel'], r['uniq'], r['last_update_date'])
        cur.execute(sql, data)
        
    conn.commit()
    conn.close()

# 습득한지 한달(31일) 지난 데이터 삭제
def delete_old_data():
    print(f"31일 전 데이터 삭제 시작")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # fdYmd가 한달전인 데이터 삭제
            sql = """
            DELETE FROM keeping_items 
            WHERE STR_TO_DATE(fdYmd, '%Y-%m-%d') < DATE_SUB(NOW(), INTERVAL 31 DAY)
            """
            cursor.execute(sql)
            conn.commit()
            print(f"31일 전 데이터 삭제 완료")
    finally:
        conn.close()