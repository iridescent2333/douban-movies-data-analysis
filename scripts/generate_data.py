"""
豆瓣电影数据洞察看板 - 电影数据集生成脚本

策略：
1. 优先尝试从 Kaggle TMDB 数据集下载（用 requests）
2. 下载失败则回退到自生成的高质量模拟数据

运行方式：python generate_data.py
输出：scripts/movies.csv  （后续由 init_h2_sql.py 读取并生成 SQL）
"""

import os
import sys
import random
import math
import csv
from datetime import datetime, timedelta

# ============================================================
#  全局种子，保证可复现
# ============================================================
random.seed(42)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_CSV = os.path.join(SCRIPT_DIR, "movies.csv")


# ============================================================
#  Kaggle 下载尝试（可选）
# ============================================================
KAGGLE_TMDB_URLS = [
    # 备用镜像：TMDB 5000 Movie Dataset 公开原始 CSV
    "https://raw.githubusercontent.com/krishnaik06/Movie-Recommender-in-python/master/tmdb_5000_movies.csv",
    "https://raw.githubusercontent.com/austinlasseter/austinlasseter.github.io/master/datasets/tmdb_5000_movies.csv",
]


def try_download_kaggle():
    """尝试下载 TMDB 电影数据，失败返回 None。"""
    try:
        import requests
    except ImportError:
        print("[INFO] 未安装 requests，跳过 Kaggle 下载")
        return None

    for url in KAGGLE_TMDB_URLS:
        try:
            print(f"[INFO] 尝试下载: {url}")
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200 and len(resp.text) > 10000:
                tmp_path = os.path.join(SCRIPT_DIR, "tmdb_raw.csv")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    f.write(resp.text)
                print(f"[OK] 下载成功：{tmp_path} ({len(resp.text)} bytes)")
                return tmp_path
        except Exception as e:
            print(f"[WARN] 下载失败: {e}")
    print("[INFO] Kaggle 下载均失败，使用本地生成数据")
    return None


# ============================================================
#  Fallback：本地电影数据库（真实 + 合理组合）
# ============================================================

# ---------- 真实电影名（中文 ~100 部）----------
REAL_CN_MOVIES = [
    "霸王别姬", "活着", "肖申克的救赎", "阿甘正传", "泰坦尼克号", "盗梦空间",
    "星际穿越", "教父", "教父2", "黑暗骑士", "黑暗骑士崛起", "指环王：护戒使者",
    "指环王：双塔奇兵", "指环王：王者归来", "千与千寻", "龙猫", "哈尔的移动城堡",
    "幽灵公主", "风之谷", "天空之城", "机器人总动员", "寻梦环游记", "飞屋环游记",
    "狮子王", "玩具总动员3", "头脑特工队", "疯狂动物城", "冰雪奇缘", "蜘蛛侠：平行宇宙",
    "哪吒之魔童降世", "姜子牙", "流浪地球", "流浪地球2", "红海行动", "战狼2",
    "我不是药神", "无间道", "无间道2", "无间道3", "英雄本色", "重庆森林", "阿飞正传",
    "花样年华", "东邪西毒", "卧虎藏龙", "青蛇", "霸王别姬", "胭脂扣", "甜蜜蜜",
    "大话西游之月光宝盒", "大话西游之大圣娶亲", "喜剧之王", "功夫", "少林足球",
    "国产凌凌漆", "九品芝麻官", "唐伯虎点秋香", "三打白骨精", "长津湖", "长津湖之水门桥",
    "封神第一部", "封神第二部", "满江红", "悬崖之上", "一秒钟", "影",
    "让子弹飞", "太阳照常升起", "红高粱", "大红灯笼高高挂", "秋菊打官司",
    "霸王别姬", "我的兄弟姐妹", "孔雀", "可可西里", "山河故人", "江湖儿女",
    "地球最后的夜晚", "大象席地而坐", "阳台上", "少年的你", "误杀",
    "你好，李焕英", "消失的爱人", "消失的她", "孤注一掷", "长安三万里",
    "八角笼中", "热烈", "封神第一部", "第二十条", "哪吒之魔童闹海",
    "唐人街探案", "唐人街探案2", "唐人街探案3", "囧妈", "泰囧", "港囧",
    "我和我的祖国", "我和我的家乡", "我和我的父辈", "金刚川", "攀登者",
]

# ---------- 真实电影名（英文 ~100 部）----------
REAL_EN_MOVIES = [
    "The Godfather", "The Godfather Part II", "The Dark Knight", "The Dark Knight Rises",
    "Inception", "Interstellar", "The Matrix", "Pulp Fiction", "Fight Club",
    "Forrest Gump", "The Shawshank Redemption", "The Green Mile", "Schindler's List",
    "Saving Private Ryan", "Gladiator", "Braveheart", "Titanic", "Avatar",
    "Avengers: Endgame", "Avengers: Infinity War", "Captain America: Civil War",
    "Iron Man", "Thor", "Doctor Strange", "Black Panther", "Spider-Man: No Way Home",
    "The Lord of the Rings: The Fellowship of the Ring",
    "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King",
    "Harry Potter and the Philosopher's Stone", "Harry Potter and the Chamber of Secrets",
    "Harry Potter and the Prisoner of Azkaban", "Harry Potter and the Goblet of Fire",
    "Star Wars: A New Hope", "Star Wars: The Empire Strikes Back",
    "Star Wars: Return of the Jedi", "Rogue One", "The Force Awakens",
    "Jurassic Park", "The Lost World: Jurassic Park", "Jurassic World",
    "The Lion King", "Toy Story", "Toy Story 2", "Toy Story 3", "Toy Story 4",
    "WALL-E", "Up", "Coco", "Inside Out", "Zootopia", "Frozen", "Moana",
    "Ratatouille", "Finding Nemo", "Finding Dory", "The Incredibles", "Cars",
    "Monsters Inc.", "Monsters University", "Soul", "Luca", "Turning Red",
    "The Incredibles 2", "Shrek", "How to Train Your Dragon", "Kung Fu Panda",
    "The Hangover", "Bridesmaids", "Superbad", "Old School", "Anchorman",
    "Step Brothers", "Talladega Nights", "The Other Guys", "21 Jump Street",
    "Bad Moms", "Pitch Perfect", "The Devil Wears Prada", "Mean Girls",
    "Legally Blonde", "13 Going on 30", "Pretty Woman", "La La Land",
    "The Greatest Showman", "A Star Is Born", "Bohemian Rhapsody",
    "Rocketman", "Yesterday", "Mamma Mia!", "Les Misérables", "Chicago",
    "Grease", "Dirty Dancing", "Flashdance", "Footloose", "Singin' in the Rain",
    "The Sound of Music", "Mary Poppins", "The Jungle Book", "Beauty and the Beast",
]

# ---------- 中文造词（前缀 + 后缀），生成约 1000 个组合 --------
CN_TITLE_PREFIX = [
    "午夜", "孤独的", "黑暗中的", "迷失的", "无声的", "被遗忘的", "最后的", "消失的",
    "无声", "逆光", "霓虹", "山海", "江湖", "山河", "岁月", "时光",
    "冬日", "夏日", "秋日", "春日", "深夜", "清晨", "黄昏", "黎明",
    "南方的", "北方的", "异乡的", "远方的", "屋顶上的", "街角的", "桥上的", "海边的",
    "霓虹灯下的", "城事", "故人", "往事", "旧梦", "新的", "蓝色的", "红色的",
    "白色的", "黑色的", "金色的", "银色的", "灰色的", "温柔的", "冷酷的",
    "沉默的", "疯狂的", "热烈的", "平静的", "不安的", "躁动的", "安静的",
    "永远的", "暂时的", "瞬间的", "漫长的", "短暂的", "无尽的",
]
CN_TITLE_MID = [
    "列车", "旅店", "咖啡馆", "小镇", "岛屿", "城市", "森林", "荒漠",
    "博物馆", "图书馆", "学校", "医院", "监狱", "工厂", "农场",
    "公路", "小巷", "天台", "地下室", "地铁", "机场", "港口",
    "列车", "巴士", "自行车", "出租车", "摩托", "飞船",
    "密码", "信号", "记忆", "日记", "信件", "照片", "声音", "气味",
    "秘密", "谎言", "真相", "牺牲", "救赎", "追寻", "告别",
    "少年", "少女", "父亲", "母亲", "兄妹", "朋友", "恋人", "陌生人",
    "乐队", "剧团", "合唱团", "科研队", "探险队", "特警队", "黑帮",
]
CN_TITLE_SUFFIX = [
    "日记", "之夜", "之日", "之前", "之后", "往事", "秘闻", "档案",
    "编年史", "传奇", "故事", "谜案", "奇遇", "漫游", "历险",
    "回响", "余音", "序章", "终章", "续集", "重启", "平行世界",
    "纪事", "札记", "随想", "素描", "切片", "碎片", "拼图",
    "2046", "2077", "2147", "2233", "启示录", "乌托邦",
]


def build_cn_titles():
    titles = list(REAL_CN_MOVIES)
    for p in CN_TITLE_PREFIX:
        for m in CN_TITLE_MID:
            for s in CN_TITLE_SUFFIX[:6]:
                titles.append(f"{p}{m}{s}")
    random.shuffle(titles)
    return titles


def build_en_titles():
    """英文组合标题：Prefix + Middle + Suffix"""
    en_prefix = [
        "The", "A", "An", "Silent", "Midnight", "Lost", "Hidden", "Forgotten",
        "Eternal", "Crimson", "Azure", "Golden", "Silver", "Black", "White",
        "Wild", "Quiet", "Restless", "Broken", "Fading", "Distant",
        "Last", "Final", "First", "Second", "Parallel", "Quantum",
        "Neon", "Glass", "Steel", "Paper", "Porcelain",
    ]
    en_mid = [
        "Garden", "City", "Island", "Forest", "Highway", "Station", "Hotel",
        "Library", "Museum", "Hospital", "Prison", "Factory", "School",
        "Sunrise", "Sunset", "Horizon", "Echo", "Shadow", "Whisper",
        "Memory", "Dream", "Nightmare", "Destiny", "Fortune", "Revenge",
        "Knight", "King", "Queen", "Prince", "Stranger", "Traveler",
        "Scientist", "Artist", "Musician", "Detective", "Spy", "Warrior",
        "Robot", "Android", "Cyborg", "Mutant", "Alien", "Wizard",
    ]
    en_suffix = [
        "", "Rising", "Falling", "Returns", "Reborn", "Awakening",
        "Chronicles", "Saga", "Legacy", "Protocol", "Archive",
        "Redemption", "Salvation", "Reckoning", "Genesis", "Revelation",
        "in 2046", "in 2077", "in 2147", "on Earth", "of Mars",
    ]
    titles = list(REAL_EN_MOVIES)
    for _ in range(800):
        p = random.choice(en_prefix)
        m = random.choice(en_mid)
        s = random.choice(en_suffix)
        title = f"{p} {m} {s}".strip()
        titles.append(title)
    random.shuffle(titles)
    return titles


# ---------- 导演池 --------
REAL_DIRECTORS = [
    # 中国
    "张艺谋", "陈凯歌", "冯小刚", "姜文", "王家卫", "杜琪峰", "吴宇森",
    "徐克", "林青霞", "李安", "侯孝贤", "杨德昌", "蔡明亮", "贾樟柯",
    "娄烨", "王小帅", "田壮壮", "顾长卫", "关锦鹏", "许鞍华",
    "宁浩", "陈思诚", "徐峥", "吴京", "郭帆", "饺子", "乌尔善",
    "文牧野", "刁亦男", "忻钰坤", "毕赣", "毕飞宇", "韩寒", "郭敬明",
    # 欧美
    "Steven Spielberg", "Martin Scorsese", "Francis Ford Coppola",
    "Christopher Nolan", "Steven Soderbergh", "David Fincher",
    "Quentin Tarantino", "Ridley Scott", "James Cameron", "Peter Jackson",
    "Ron Howard", "Robert Zemeckis", "William Wyler", "Billy Wilder",
    "Stanley Kubrick", "Alfred Hitchcock", "Orson Welles",
    "Clint Eastwood", "Michael Bay", "J.J. Abrams", "Ryan Coogler",
    "Greta Gerwig", "Denis Villeneuve", "Edgar Wright",
    # 日韩
    "宫崎骏", "高畑勋", "今敏", "新海诚", "细田守",
    "是枝裕和", "黑泽明", "小津安二郎", "沟口健二",
    "奉俊昊", "朴赞郁", "崔东勋", "金成勋", "李政宰",
    # 其他
    "Satyajit Ray", "Bong Joon-ho", "Park Chan-wook",
    "François Truffaut", "Jean-Luc Godard", "Federico Fellini",
    "Akira Kurosawa", "Hayao Miyazaki",
]


# ---------- 演员池 --------
REAL_ACTORS = [
    # 中国
    "张国荣", "梁朝伟", "刘德华", "周润发", "成龙", "李连杰", "甄子丹",
    "金城武", "吴彦祖", "古天乐", "余文乐", "谢霆锋", "陈冠希",
    "张曼玉", "林青霞", "王祖贤", "巩俐", "章子怡", "周迅", "赵薇",
    "范冰冰", "李冰冰", "舒淇", "林志玲", "汤唯", "高圆圆",
    "葛优", "姜文", "陈道明", "陈建斌", "黄渤", "徐峥", "王宝强",
    "邓超", "孙俪", "杨幂", "赵丽颖", "刘亦菲", "杨紫", "张一山",
    "沈腾", "马丽", "贾玲", "张小斐", "吴京", "张译", "廖凡",
    "赵涛", "周冬雨", "易烊千玺", "王源", "王俊凯", "吴亦凡",
    # 欧美
    "Tom Hanks", "Leonardo DiCaprio", "Brad Pitt", "George Clooney",
    "Johnny Depp", "Will Smith", "Tom Cruise", "Christian Bale",
    "Matthew McConaughey", "Ryan Gosling", "Ryan Reynolds", "Chris Evans",
    "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo", "Jeremy Renner",
    "Scarlett Johansson", "Emma Watson", "Emma Stone", "Jennifer Lawrence",
    "Natalie Portman", "Anne Hathaway", "Cate Blanchett", "Kate Winslet",
    "Angelina Jolie", "Julia Roberts", "Meryl Streep", "Denzel Washington",
    "Morgan Freeman", "Michael Caine", "Gary Oldman", "Hugh Jackman",
    "Keanu Reeves", "Jim Carrey", "Robin Williams", "Jack Black",
    "Dwayne Johnson", "Kevin Hart", "Adam Sandler", "Seth Rogen",
    # 日韩
    "木村拓哉", "小栗旬", "松山健一", "佐藤健", "菅田将晖",
    "深津绘里", "松隆子", "长泽雅美", "苍井优", "桥本环奈",
    "宋仲基", "宋慧乔", "全智贤", "李敏镐", "金秀贤", "林允儿",
    "郑雨盛", "李秉宪", "崔岷植", "河正宇", "黄政民",
    # 印度
    "Shah Rukh Khan", "Aamir Khan", "Salman Khan", "Hrithik Roshan",
    "Deepika Padukone", "Priyanka Chopra", "Aishwarya Rai",
    # 其他
    "Rowan Atkinson", "Ralph Fiennes", "Helen Mirren", "Judi Dench",
    "Mads Mikkelsen", "Penélope Cruz", "Javier Bardem",
]


# ---------- 类型列表 --------
GENRES = [
    "剧情", "喜剧", "爱情", "动画", "科幻", "悬疑", "恐怖",
    "动作", "战争", "文艺", "主旋律", "纪录片", "短片", "Cult",
]

# 类型 -> 基础评分偏好（越高表示倾向高分）
GENRE_RATING_BIAS = {
    "动画": 0.6, "纪录片": 0.5, "文艺": 0.4, "剧情": 0.3,
    "爱情": 0.1, "喜剧": 0.0, "悬疑": 0.0, "科幻": 0.0,
    "动作": -0.1, "战争": 0.2, "恐怖": -0.3, "主旋律": 0.1,
    "短片": 0.2, "Cult": 0.3,
}

# 类型 -> 预算倍数倾向
GENRE_BUDGET_BIAS = {
    "科幻": 3.0, "动作": 2.5, "战争": 2.2, "动画": 2.0,
    "悬疑": 1.2, "喜剧": 1.0, "爱情": 0.8, "恐怖": 0.7,
    "剧情": 0.9, "文艺": 0.5, "主旋律": 1.5, "纪录片": 0.3,
    "短片": 0.2, "Cult": 0.4,
}


# ---------- 国家/地区 --------
COUNTRIES = [
    "中国大陆", "中国香港", "中国台湾",
    "美国", "日本", "韩国", "印度",
    "英国", "法国", "德国",
]

# 国家 -> 产出概率权重
COUNTRY_WEIGHTS = [25, 10, 8, 25, 10, 8, 5, 4, 3, 2]


# ---------- 简介模板 --------
SYNOPSIS_TEMPLATES_CN = [
    "一个关于{topic}的故事，讲述了{who}在{where}经历的{event}。",
    "影片聚焦于{who}，在{when}的背景下，面对{conflict}做出了{choice}。",
    "{who}意外卷入一场关于{topic}的事件，命运自此改变。",
    "在{where}，{who}与{who2}因{topic}相遇，展开了一段{emotion}的旅程。",
    "一场关于{topic}的探索，揭示了{secret}背后的真相。",
    "{who}在{where}追寻{topic}，却发现{secret}。",
    "当{when}来临，{who}必须面对{conflict}，做出关乎{topic}的抉择。",
    "讲述了{who}在{where}度过的一段{emotion}时光，关于{topic}的回忆。",
]

SYNOPSIS_TEMPLATES_EN = [
    "A story about {topic}, following {who} who experiences {event} in {where}.",
    "Set against the backdrop of {when}, {who} faces {conflict} and makes {choice}.",
    "{who} stumbles into an incident involving {topic}, changing their fate forever.",
    "In {where}, {who} and {who2} meet over {topic}, embarking on a {emotion} journey.",
    "An exploration of {topic} that unveils the truth behind {secret}.",
    "{who} searches for {topic} in {where}, only to discover {secret}.",
    "When {when} arrives, {who} must confront {conflict} and decide on {topic}.",
    "Chronicling a {emotion} period of {who}'s life in {where}, revolving around {topic}.",
]

SYNOPSIS_WHO = [
    "一位年轻的梦想家", "一位退休的老兵", "一对失散的恋人",
    "一名孤独的侦探", "一个天才科学家", "一群不羁的少年",
    "一位隐忍的母亲", "一名怀揣秘密的移民", "一名走投无路的赌徒",
    "一名坚持理想的记者", "一名逃离过去的流浪者", "一对同甘共苦的兄弟",
]
SYNOPSIS_WHO_EN = [
    "a young dreamer", "a retired soldier", "a separated couple",
    "a lone detective", "a brilliant scientist", "a group of rebellious teens",
    "a devoted mother", "an immigrant with a secret", "a desperate gambler",
    "an idealistic journalist", "a fugitive from the past", "two brothers who stick together",
]
SYNOPSIS_WHERE = [
    "繁华的都市", "偏远的山村", "寒冷的边境小镇", "温暖的海岛",
    "神秘的地下城市", "即将消失的工业区", "充满历史的老街", "繁忙的太空站",
]
SYNOPSIS_WHERE_EN = [
    "a bustling metropolis", "a remote mountain village", "a cold border town", "a warm island",
    "a mysterious underground city", "a fading industrial zone", "a historic old street", "a busy space station",
]
SYNOPSIS_TOPIC = [
    "救赎与希望", "爱与背叛", "记忆与身份", "科技与人性",
    "战争与和平", "自由与代价", "成长与告别", "真相与谎言",
    "梦想与现实", "家庭与责任",
]
SYNOPSIS_CONFLICT = [
    "无法调和的矛盾", "关乎生死的抉择", "深藏多年的秘密", "来自过去的阴影",
    "人性深处的挣扎", "命运无情的捉弄",
]
SYNOPSIS_CHOICE = [
    "艰难的抉择", "意想不到的决定", "回归初心的选择", "改变命运的一步",
]
SYNOPSIS_SECRET = [
    "惊天的阴谋", "被掩埋的真相", "家族世代的秘密", "一个不该存在的人",
]
SYNOPSIS_EMOTION = [
    "动人心魄", "催人泪下", "惊心动魄", "温暖治愈", "荒诞离奇", "震撼心灵",
]
SYNOPSIS_WHEN = [
    "一个盛夏", "一个寒冬", "战争年代", "和平时期", "科技高度发达的未来", "经济萧条的年代",
]


def gen_synopsis(is_chinese):
    if is_chinese:
        tpl = random.choice(SYNOPSIS_TEMPLATES_CN)
        return tpl.format(
            who=random.choice(SYNOPSIS_WHO),
            who2=random.choice(SYNOPSIS_WHO),
            where=random.choice(SYNOPSIS_WHERE),
            topic=random.choice(SYNOPSIS_TOPIC),
            conflict=random.choice(SYNOPSIS_CONFLICT),
            choice=random.choice(SYNOPSIS_CHOICE),
            secret=random.choice(SYNOPSIS_SECRET),
            emotion=random.choice(SYNOPSIS_EMOTION),
            when=random.choice(SYNOPSIS_WHEN),
            event="一段非同寻常的经历",
        )
    else:
        tpl = random.choice(SYNOPSIS_TEMPLATES_EN)
        return tpl.format(
            who=random.choice(SYNOPSIS_WHO_EN),
            who2=random.choice(SYNOPSIS_WHO_EN),
            where=random.choice(SYNOPSIS_WHERE_EN),
            topic=random.choice(SYNOPSIS_TOPIC),
            conflict=random.choice(SYNOPSIS_CONFLICT),
            choice=random.choice(SYNOPSIS_CHOICE),
            secret=random.choice(SYNOPSIS_SECRET),
            emotion=random.choice(SYNOPSIS_EMOTION),
            when=random.choice(SYNOPSIS_WHEN),
            event="an extraordinary journey",
        )


# ============================================================
#  生成单部电影
# ============================================================

def pick_country():
    return random.choices(COUNTRIES, weights=COUNTRY_WEIGHTS, k=1)[0]


def pick_genres(n=2):
    """选 1-3 个类型，主类型在前。"""
    n = min(random.randint(1, 3), len(GENRES))
    return random.sample(GENRES, n)


def pick_year():
    """1995-2025，中间年份概率高。"""
    years = list(range(1995, 2026))
    weights = [1.0 + 0.03 * abs(y - 2010) for y in years]  # 中间重、两端轻
    return random.choices(years, weights=weights, k=1)[0]


def pick_runtime():
    """片长：75-180，典型 90-120 概率高。"""
    r = random.gauss(108, 18)
    return max(70, min(185, int(round(r))))


def pick_rating(genres, country):
    """评分：正态 N(7.0, 1.2)，叠加类型和国家偏置。"""
    bias = sum(GENRE_RATING_BIAS.get(g, 0) for g in genres) / max(len(genres), 1)
    if country in ("中国大陆", "中国香港", "中国台湾"):
        bias += random.uniform(-0.1, 0.2)  # 华语片整体略偏
    r = random.gauss(7.0 + bias, 1.2)
    r = max(2.0, min(9.8, round(r, 1)))
    return r


def pick_votes(rating):
    """评价人数：和评分 log 正相关，评分高 -> 人数多。"""
    base = 500 + (rating - 2.0) * 5000
    noise = random.gauss(0, 800)
    v = int(max(200, base + noise))
    # 热门爆款：小概率指数放大
    if rating >= 8.5 and random.random() < 0.35:
        v = int(v * random.uniform(3, 10))
    return v


def pick_financials(genres, rating, country):
    """预算 + 票房（美元），约 50% 电影带财务数据。"""
    if random.random() < 0.50:
        return None, None

    # 基础预算：按类型偏置
    genre_bias = sum(GENRE_BUDGET_BIAS.get(g, 1.0) for g in genres) / max(len(genres), 1)
    base_budget = random.gauss(50_000_000, 40_000_000) * genre_bias
    # 中国电影预算整体低一档
    if country in ("中国大陆", "中国香港", "中国台湾"):
        base_budget *= random.uniform(0.3, 0.7)
    budget = max(500_000, int(round(base_budget)))

    # 票房 = 预算 * 倍数，评分越高倍数越大
    multiplier_base = 0.3 + rating * 0.5  # 评分 7 -> ~3.8
    multiplier = random.gauss(multiplier_base, 1.5)
    multiplier = max(0.3, min(12.0, multiplier))
    box_office = max(0, int(round(budget * multiplier)))

    return budget, box_office


def pick_release_date(year, genres, rating):
    """根据档期选择具体上映日期。"""
    month = pick_month_by_slot(genres, rating)
    day = random.randint(1, 28)
    return f"{year}-{month:02d}-{day:02d}"


def pick_month_by_slot(genres, rating):
    """档期规则：
    12-1月=贺岁/春节档，7-8月=暑期档，10月=国庆档，其余=淡季
    """
    slot_probs = {
        # (月份列表, 权重)
        "贺岁/春节档": ([12, 1], 25),
        "暑期档": ([7, 8], 28),
        "国庆档": ([10], 12),
        "五一档": ([5], 8),
        "圣诞档": ([11], 5),
        "淡季": ([2, 3, 4, 6, 9], 22),
    }
    keys = list(slot_probs.keys())
    weights = [v[1] for v in slot_probs.values()]

    # 主旋律/战争片倾向国庆档
    if any(g in ("主旋律", "战争") for g in genres) and random.random() < 0.6:
        return random.choice([10])
    # 动画/家庭片倾向暑期或圣诞
    if "动画" in genres and random.random() < 0.5:
        return random.choice([7, 8, 11])
    # 爱情片倾向情人节/暑期
    if "爱情" in genres and random.random() < 0.4:
        return random.choice([2, 7, 8])

    slot = random.choices(keys, weights=weights, k=1)[0]
    return random.choice(slot_probs[slot][0])


def get_slot_name(release_date):
    """根据上映日期判断档期名称。"""
    if not release_date:
        return "未知"
    try:
        month = int(release_date.split("-")[1])
    except Exception:
        return "未知"
    if month in (12, 1):
        return "贺岁/春节档"
    if month in (7, 8):
        return "暑期档"
    if month == 10:
        return "国庆档"
    if month == 5:
        return "五一档"
    if month == 11:
        return "圣诞档"
    return "淡季"


# ============================================================
#  主生成流程
# ============================================================

def generate_movies(n=850):
    cn_titles = build_cn_titles()
    en_titles = build_en_titles()

    titles = cn_titles + en_titles
    random.shuffle(titles)
    titles = titles[:n]

    movies = []
    for i, title in enumerate(titles):
        country = pick_country()
        genres = pick_genres(random.randint(1, 3))
        year = pick_year()
        runtime = pick_runtime()
        rating = pick_rating(genres, country)
        votes = pick_votes(rating)
        directors = random.sample(REAL_DIRECTORS, random.randint(1, 2))
        actors = random.sample(REAL_ACTORS, random.randint(2, 5))
        is_chinese = any('\u4e00' <= c <= '\u9fff' for c in title)
        synopsis = gen_synopsis(is_chinese)
        budget, box_office = pick_financials(genres, rating, country)
        release_date = pick_release_date(year, genres, rating)
        slot = get_slot_name(release_date)

        movies.append({
            "id": i + 1,
            "title": title,
            "director": "; ".join(directors),
            "actors": "; ".join(actors),
            "genres": "; ".join(genres),
            "country": country,
            "year": year,
            "runtime": runtime,
            "rating": rating,
            "votes": votes,
            "synopsis": synopsis,
            "budget": budget,
            "box_office": box_office,
            "release_date": release_date,
            "slot": slot,
        })

    return movies


# ============================================================
#  验证 & 统计
# ============================================================

def validate_and_print(movies):
    print("\n" + "=" * 60)
    print("  数据质量检查报告")
    print("=" * 60)

    n = len(movies)
    years = sorted(set(m["year"] for m in movies))
    all_genres = set()
    for m in movies:
        all_genres.update(m["genres"].split("; "))
    all_countries = set(m["country"] for m in movies)
    fin_count = sum(1 for m in movies if m["budget"] is not None)

    print(f"\n[基本指标]")
    print(f"  电影总数        : {n} 条  {'✅' if n >= 800 else '❌'}")
    print(f"  年份覆盖        : {len(years)} 年 ({years[0]}-{years[-1]})  {'✅' if len(years) >= 20 else '❌'}")
    print(f"  类型数          : {len(all_genres)} 种  {'✅' if len(all_genres) >= 10 else '❌'}")
    print(f"  国家/地区       : {len(all_countries)} 个  {'✅' if len(all_countries) >= 5 else '❌'}")
    print(f"  带财务数据      : {fin_count} 条 ({fin_count/n*100:.1f}%)  {'✅' if 0.4 <= fin_count/n <= 0.6 else '⚠️'}")

    print(f"\n[各类型电影数量]")
    genre_count = {}
    for m in movies:
        for g in m["genres"].split("; "):
            genre_count[g] = genre_count.get(g, 0) + 1
    for g, c in sorted(genre_count.items(), key=lambda x: -x[1]):
        print(f"  {g:8s}: {c:4d}")

    print(f"\n[各年代数量]")
    decade_count = {}
    for m in movies:
        d = (m["year"] // 10) * 10
        decade_count[d] = decade_count.get(d, 0) + 1
    for d, c in sorted(decade_count.items()):
        bar = "█" * int(c / max(decade_count.values()) * 30)
        print(f"  {d}s : {c:4d}  {bar}")

    print(f"\n[评分分布直方图]")
    ratings = [m["rating"] for m in movies]
    for lo in [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0]:
        hi = lo + 1.0
        c = sum(1 for r in ratings if lo <= r < hi)
        if lo == 9.0:
            c = sum(1 for r in ratings if r >= 9.0)
        bar = "█" * int(c / max(n, 1) * 40)
        print(f"  [{lo:4.1f}, {hi:4.1f}) : {c:4d}  {bar}")
    print(f"  均值: {sum(ratings)/len(ratings):.2f}  标准差: {math.sqrt(sum((r - sum(ratings)/len(ratings))**2 for r in ratings)/len(ratings)):.2f}")

    print(f"\n[国家/地区分布]")
    country_count = {}
    for m in movies:
        country_count[m["country"]] = country_count.get(m["country"], 0) + 1
    for c, cnt in sorted(country_count.items(), key=lambda x: -x[1]):
        print(f"  {c:10s}: {cnt:4d}")

    print(f"\n[档期分布]")
    slot_count = {}
    for m in movies:
        s = m["slot"] or "未知"
        slot_count[s] = slot_count.get(s, 0) + 1
    for s, c in sorted(slot_count.items(), key=lambda x: -x[1]):
        print(f"  {s:10s}: {c:4d}")

    print(f"\n[财务数据覆盖率]")
    for c in sorted(country_count.keys()):
        sub = [m for m in movies if m["country"] == c]
        f = sum(1 for m in sub if m["budget"] is not None)
        avg_budget = sum(m["budget"] or 0 for m in sub) / max(1, f)
        print(f"  {c:10s}: {f}/{len(sub)} 条带财务  平均预算 ${avg_budget:,.0f}")

    all_pass = (
        n >= 800 and len(years) >= 20 and len(all_genres) >= 10
        and len(all_countries) >= 5 and 0.4 <= fin_count / n <= 0.6
    )
    print(f"\n{'🎯 全部检查通过！' if all_pass else '⚠️ 有部分指标不达标'}")
    print("=" * 60 + "\n")
    return all_pass


# ============================================================
#  CSV 输出
# ============================================================

def write_csv(movies, path):
    fields = [
        "id", "title", "director", "actors", "genres", "country",
        "year", "runtime", "rating", "votes", "synopsis",
        "budget", "box_office", "release_date", "slot",
    ]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for m in movies:
            row = dict(m)
            for k in ("budget", "box_office"):
                row[k] = "" if row[k] is None else row[k]
            w.writerow(row)
    print(f"[OK] CSV 已写入: {path}")


# ============================================================
#  入口
# ============================================================

def main():
    print("=" * 60)
    print("  豆瓣电影数据看板 - 数据生成器")
    print("=" * 60)

    # 1. 尝试 Kaggle 下载
    kaggle_path = try_download_kaggle()

    if kaggle_path:
        print("[INFO] 可以扩展：解析 Kaggle CSV 并映射到我们的字段")
        # 本次作业先用 fallback，保持独立可复现
        # 真实项目可在此把 tmdb_raw.csv 解析成 movies 结构

    # 2. Fallback / 主流程：本地生成
    print("[INFO] 使用本地生成数据（seed=42）...")
    movies = generate_movies(n=850)

    # 3. 写 CSV
    write_csv(movies, OUTPUT_CSV)

    # 4. 验证 & 统计
    ok = validate_and_print(movies)

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
