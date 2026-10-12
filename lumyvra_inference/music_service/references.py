"""Reviewed songwriting references; no copied lyrics, melodies or training audio."""

REFERENCE_VERSION = "songwriting-craft-v6-20261012"

# Primary teaching sources and separately labeled community score observations.
# Rules below are our production hypotheses, not facts guaranteed by the scores.
SOURCES = (
    {"id": "wanan-release", "url": "https://www.youtube.com/watch?v=romoX9qv87k",
     "type": "distributor_release_metadata", "title": "晚安 — 颜人中, distributor-provided release",
     "observation": "Credits identify Chen Zhijie as writer and Guan Tiantian as arranger/producer; "
                    "metadata verifies the version, not its melody or measured tempo."},
    {"id": "zhimibuwu-release", "url": "https://www.youtube.com/watch?v=bIDUNt1pTwU",
     "type": "distributor_release_metadata", "title": "执迷不悟 — 小乐哥, distributor-provided release",
     "observation": "Credits name Pan Yixiang as composer and Zhou Ren as lyricist. Release metadata "
                    "does not substitute for a score or audio analysis."},
    {"id": "wanan-arranger-preview", "url": "https://www.guitarworld.com.cn/pu/q11258",
     "type": "arranger_published_preview", "title": "晚安 — 杨鑫/必需音乐 public arrangement preview",
     "observation": "The public preview contains repeated vocal pitches, varied subdivisions and "
                    "a 54 BPM marking for this C-position guitar arrangement; not verified recording tempo."},
    {"id": "luocha-arranger-preview", "url": "https://www.guitarworld.com.cn/pu/q32198",
     "type": "arranger_published_preview", "title": "落差 — 袁崔挺 public arrangement preview",
     "observation": "The preview shows a repeated-pitch start, descending motion and unequal held/running "
                    "note lengths. It is an arrangement excerpt, not an official complete transcription."},
    {"id": "mishihuanjing-arranger-preview", "url": "https://www.guitarworld.com.cn/pu/q30952",
     "type": "arranger_published_preview", "title": "迷失幻境 — 袁崔挺 public arrangement preview",
     "observation": "The visible opening uses similar rhythmic cells and mostly nearby vocal pitches "
                    "over recurring harmony. Full chorus and original recording timing are not verified."},
    {"id": "levitating-authors", "url": "https://songexploder.net/transcripts/dua-lipa-transcript.pdf",
     "type": "author_interview", "title": "Levitating — Dua Lipa and Koz, Song Exploder, 2020",
     "observation": "The authors describe writing melody over a groove, a recurring synth identity, "
                    "and later revising bass movement. This is not a transcription of the song."},
    {"id": "please-authors",
     "url": "https://songexploder.net/wp-content/uploads/2024/12/Song-Exploder-Sabrina-Carpenter-Transcript.pdf",
     "type": "author_interview", "title": "Please Please Please — Sabrina Carpenter and Jack Antonoff, 2024",
     "observation": "The writers discuss a short verbal hook, a recognizable instrumental riff "
                    "and a specific personal situation. No lyrics or riff notes are copied."},
    {"id": "apt-producer",
     "url": "https://www.musicweek.com/interviews/read/hitmakers-cirkut-on-the-making-of-apt-by-ros-bruno-mars/091474",
     "type": "author_interview", "title": "APT. — Cirkut, Music Week, updated 2026",
     "observation": "Cirkut describes starting with a rhythmic hook and drums, then developing the "
                    "pre-chorus and bridge. These are workflow observations, not a mandatory song formula."},
    {"id": "bunetta-song-first", "url": "https://www.soundonsound.com/techniques/inside-track-julian-bunetta",
     "type": "author_interview", "title": "Julian Bunetta — Sound On Sound, September 2024",
     "observation": "The producer emphasizes chorus words and melody, and movement across an arrangement "
                    "rather than an unchanged long loop; not a detailed Espresso score analysis."},
    {"id": "treasure-analysis", "url": "https://www.hooktheory.com/theorytab/view/bruno-mars/treasure",
     "type": "community_score_analysis", "title": "Treasure — Bruno Mars",
     "observation": "The analysis lists 116 BPM, Eb major; the chorus has a narrower melody range than the pre-chorus."},
    {"id": "finesse-analysis", "url": "https://www.hooktheory.com/theorytab/view/bruno-mars/finesse-remix-ft-cardi-b",
     "type": "community_score_analysis", "title": "Finesse Remix — Bruno Mars",
     "observation": "The analysis lists 105 BPM, F minor; its chorus spans one octave, narrower than the pre-chorus."},
    {"id": "ableton-contour", "url": "https://makingmusic.ableton.com/creating-melodies-1-contour",
     "type": "composer_teaching", "title": "Creating Melodies 1: Contour",
     "observation": "Melodic contour describes movement up, down and at the same pitch; separate contour from rhythm."},
    {"id": "ableton-variation", "url": "https://makingmusic.ableton.com/creating-variation-2-mutation-over-generations",
     "type": "composer_teaching", "title": "Creating Variation 2: Mutation Over Generations",
     "observation": "Develop a small musical idea by changing one meaningful parameter at a time."},
    {"id": "berklee-motif-contrast", "url": "https://online.berklee.edu/takenote/simple-tools-for-better-melodies/",
     "type": "composer_teaching", "title": "Writing Melodies: 3 Simple Tools — Andrea Stolpe",
     "observation": "Motifs, repetition and contrast in note lengths, rests and phrase placement can shape melody."},
    {"id": "berklee-prosody", "url": "https://online.berklee.edu/takenote/prosody-in-music-and-songwriting/",
     "type": "composer_teaching", "title": "Prosody in Music and Songwriting — Pat Pattison",
     "observation": "Lyrics, melody, harmony and rhythm should support the song's central emotional idea."},
    {"id": "ableton-dramatic-arc", "url": "https://makingmusic.ableton.com/dramatic-arc",
     "type": "composer_teaching", "title": "Dramatic Arc",
     "observation": "Tension and release can involve changes of texture without literally ascending in pitch."},
    {"id": "ableton-subtractive-arrangement", "url": "https://makingmusic.ableton.com/arranging-as-a-subtractive-process",
     "type": "composer_teaching", "title": "Arranging as a Subtractive Process",
     "observation": "Removing musical layers can create space and organize an arrangement over time."},
    {"id": "ableton-lyric-rhythm", "url": "https://makingmusic.ableton.com/the-rhythm-of-lyrics",
     "type": "composer_teaching", "title": "The Rhythm of Lyrics",
     "observation": "Natural text accents and musical phrasing interact; the teaching examples are chiefly English."},
    {"id": "ableton-song-form", "url": "https://makingmusic.ableton.com/common-forms-1-elements-of-song-form",
     "type": "composer_teaching", "title": "Common Forms 1: Elements of Song Form",
     "observation": "Verse, chorus and bridge have distinct roles; recurring choruses commonly retain words and music."},
    {"id": "pugetsound-cadences", "url": "https://musictheory.pugetsound.edu/mt21c/cadences.html",
     "type": "university_textbook", "title": "Cadences — Robert Hutchinson",
     "observation": "Harmonic arrival and phrase boundaries contribute to a sense of closure or continuation."},
    {"id": "pugetsound-open-closed-sections",
     "url": "https://musictheory.pugetsound.edu/mt21c/HarmonicallyClosedAndOpenSections.html",
     "type": "university_textbook", "title": "Harmonically Closed and Open Sections — Robert Hutchinson",
     "observation": "Sections leading to a chorus can remain harmonically open; choruses may be open or closed."},
    {"id": "ismir-repetition-structure", "url": "https://arxiv.org/abs/2209.00182",
     "type": "research_paper", "title": "What is missing in deep music generation? — Dai, Yu, Dannenberg, 2022",
     "observation": "The authors study hierarchical repetition and musical structure in Chinese and American pop."},
)


def songwriting_brief(genre: str, *, seconds: int = 180, instrumental: bool = False,
                      lyrics_locked: bool = False, profile: str = "balanced") -> dict | None:
    if genre not in {"流行", "R&B"}:
        return None
    brief = {
        "version": REFERENCE_VERSION,
        "basis": "原作者创作访谈、作曲教学、大学教材、结构研究及标明的社区谱例；下面是待试听验证的制作假设，不复制歌曲。",
        "sourceIds": [source["id"] for source in SOURCES],
        "hook": "先构思可辨认的短动机，常用1-2小节作为起点；可按A、A轻变、B回答、A收束发展，"
                "后续副歌保留钩子的起拍、主要节奏与轮廓，不每句重写，也不首次就填满转音。",
        "pitch": "核心动机先控制在约五度到八度内，以邻近音、重复音和稳定句尾为主；大跳只留给一个重点。"
                 "副歌不必更高或更宽，可用更稳定的动机、鼓组和和声形成高潮。大调或小调按情绪选，不固定同一调。",
        "rhythm": "句头允许八分音符弱起或轻切分，句尾留半拍到一拍呼吸；不要每句都从第一拍开始或连续填满音节。",
        "grooveChoices": {
            "instruction": "先选一个能让人跟拍的律动，再在其上安排自然词组和旋律；两种方案择一，不能全堆到caption。"
                           "用户指定慢歌、拍号或速度时服从用户，不用快歌模板覆盖。",
            "dancePop": "清楚的四拍重心，弹性短贝斯、反拍吉他/键盘；主歌稀疏，副歌稳定底鼓和更完整贝斯进入。",
            "popRnb": "有停顿的切分底鼓与贝斯相互扣合，军鼓保持清楚重心，Rhodes留白；主歌短促对话，副歌短钩子接较长回答。",
            "preferredStartingPoint": "popRnb" if genre == "R&B" else "dancePop",
        },
        "phraseDesign": "先给核心词组一个能拍手辨认的节奏，重复时保留它；搭配一个较长回答，"
                        "用不同起拍、音长和休止形成问答，不让每行都套同一个五到七音的节奏。"
                        "关键词值得拉长，虚词经过即可；长句仍按语义分组，中文声调适配需演唱检验。",
        "arrangementDevelopment": "写清楚某声部进入、退出或改变奏法，而非只给能量分数。"
                                  "鼓贝斯节奏可以共享全曲身份，但每段的密度和停顿有目的地变化；"
                                  "副歌前可撤掉最后半拍/一拍的低频，副歌回来落到稳定重心。"
                                  "一个简短乐器回答只放在人声休止处，避免和歌词抢同一时间。",
        "harmony": "用清楚的和弦根音与句尾落点建立方向，七和弦只是色彩；不要为了R&B堆满复杂和弦。",
        "sectionContrast": {
            "verse": "主歌用有留白的短乐句和收敛配器展开场景，不从开头就满鼓、满和声。",
            "transition": "向副歌形成期待；可连接乐句或增加节奏活动，入副歌前给关键声部让位，不只是提高音量。"
                          if seconds > 90 else "短曲直接形成主歌到副歌的清晰切换，不强塞预副歌和桥段。",
            "chorus": "与主歌选择至少两项互相支持的区别：短音与关键词长音、留白与更连贯乐句、"
                      "鼓贝斯进入、伴奏回答。钩子保持可辨认，不强制升调或更高音区。",
            "later": "桥段可减少鼓贝斯或改变表达视角；末次副歌恢复律动并少量加乐器回答，保留钩子，最后回落收束。"
                     if seconds > 150 else "重复副歌保留钩子，结尾明确收束；时长有限时省去桥段。",
        },
        "selfReview": "输出前检查段落不是只换标签：主歌如何收敛、副歌如何回应、高潮前让出什么空间？"
                      "旋律、节奏、和声和歌词要服务同一情绪；这是软条件计划，不等于已经听评合格。",
        "caption": "512字符内先保留用户关键风格与演唱/主奏，再选最重要的钩子特征和两项段落对比；"
                   "长曲可简写桥段减法与末次发展，短曲省去长结构。不把音符表或艺术家名字塞进描述。",
    }
    if instrumental:
        brief["phraseDesign"] = "主奏用短动机接较长回答；起拍、休止、音长形成问答，重复时保留辨识节奏。"
        brief["arrangementDevelopment"] = "以鼓贝斯进入、退出、奏法变化体现发展，副歌前可撤去最后一拍低频；"
        brief["arrangementDevelopment"] += "让短乐器回答位于主奏休止处，不叠在主奏钩子上。"
        contrast = brief["sectionContrast"]
        contrast["chorus"] = contrast["chorus"].replace("主唱和声回答", "主奏与乐器回答")
        contrast["later"] = contrast["later"].replace("和声回答", "乐器回答")
        brief["delivery"] = "纯音乐钩子由主奏或节奏承担；用主奏乐句、音色和声部进入实现对比；不加歌词、主唱或人声和声。"
    else:
        brief["delivery"] = "单一主唱靠前，辅音清晰、元音稳定，词组之间留换气，关键词留时值；"
        brief["delivery"] += "少转音，不默认叠加和声、气声或厚混响；主歌对话感、副歌反复表达核心句，声线服从用户选择。"
        brief["lyrics"] = (
            "歌词已锁定，lyrics逐字保留原文和换行。没有标签时提供indexedLyricLines的sections映射，由程序派生独立演唱排版；"
            "不删字、不改副歌，不能把分段标签当成强制音符对齐。"
            if lyrics_locked else
            "一个场景、一条情绪线、一个可反复唱的核心句；第二主歌推进事件或态度。"
            "自然口语与语义分组支持乐句重心，避免强押韵、碎词和意象堆砌。"
            "中文不是每字等时值或每字一个重音；声调、咬字与旋律适配仍需实际演唱确认。"
        )
        if not lyrics_locked:
            brief["lyricCraft"] = {
                "imagery": "用同一场景中有关联的画面，让物件参与事件，而不是堆名词；比喻与叙事能解释，不为诗意制造生硬搭配。",
                "sound": "自然语序与情绪先于押韵，邻近韵脚即可；不加赘词，不把整段等长同节奏。",
                "development": "主歌展示处境，副歌提炼核心感受，第二主歌让事件或态度发生变化，不重复生活物件清单。",
                "prosody": "先确定词组和关键语义，再留出延音与呼吸；短核心句与较长回答可以交替。总演唱预算不变。",
                "review": "内部自审不自然语法、画面断裂、为押韵添加的赘词和泛化结尾，只输出改好的词；不额外调用审稿API。",
            }
    if profile in {"mandarin_melodic", "mandarin_electro"}:
        brief["referencePreference"] = {
            "profile": profile,
            "userProvidedSongs": ["晚安—颜人中", "执迷不悟—小乐哥", "落差—IN-K/王忻辰", "迷失幻境—IN-K/王忻辰"],
            "versionAssumption": "原版" if profile == "mandarin_melodic" else "DJ/电子编曲方向",
            "priority": "这是当前项目用户的参考偏好，不是全体用户的审美规则。用户本次明确的情绪、速度、曲风、语言优先。",
            "basis": "用户歌名、发行署名和公开编配谱局部观察；以下为原创制作假设，不复制原曲音符或推断未读副歌。",
            "tempo": "先按词组容量和情绪选择自然速度，不固定96-116 BPM；约70-90 BPM可作为原版情歌试验起点，"
                     "不是四首参考歌的测定速度。电子方向用更活跃鼓组但保留旋律和字词的空间。",
        }
        brief["grooveChoices"]["melodicPop"] = "中文旋律型情歌，稳定拍感与有呼吸的钢琴/吉他、贝斯、克制鼓组；"
        brief["grooveChoices"]["melodicPop"] += "主歌收敛，副歌完整鼓贝斯进入，不默认四拍舞曲或funk吉他。"
        brief["grooveChoices"]["preferredStartingPoint"] = "melodicPop"
        brief["grooveChoices"]["instruction"] = "选择符合本次用户要求的一种主要律动；项目偏好可帮助选择，不覆盖用户明确要求。"
        brief["hook"] = "钩子是可辨认的旋律起句和句尾回应，不要求三字口号。重复一个小的音高/节奏细胞，"
        brief["hook"] += "用连贯的较长乐句展开；副歌重复时保留辨识轮廓和核心句，不全曲套同一个节奏。"
        brief["phraseDesign"] = ("主奏用重复音与邻近音建立辨识细胞，较长乐句展开，局部峰值后回落，末句收束。"
                                 if instrumental else
                                 "副歌可用8-12字完整句，但服从lyricBudget总字数；按词组配置短音、关键词长音和休止，"
                                 "不要均分汉字，不强行押韵。旋律以重复音、级进和句尾回应为主，高潮留一个表达重点，"
                                 "随后回落。少量延音连接语义，少转音，避免口号式喊唱。")
        if profile == "mandarin_electro":
            brief["grooveChoices"]["melodicPop"] += "使用清楚的电子鼓、脉冲贝斯与简短合成器回答，编曲推动而主旋律仍连贯。"
    return brief


def knowledge_refs(genre: str) -> list[dict]:
    return [{"id": source["id"], "url": source["url"], "type": source["type"]} for source in SOURCES] if songwriting_brief(genre) else []
