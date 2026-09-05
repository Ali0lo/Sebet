"""
Azerbaijani Latin & Russian Transliteration and Search Normalizer.
Provides bidirectional accent folding, tokenization, and fuzzy matching.
"""
import re
import unicodedata
from difflib import SequenceMatcher
from typing import List, Set

# Mapping of Azerbaijani and Cyrillic specific characters to ASCII Latin equivalents
AZ_CHAR_MAP = {
    "ə": "e", "Ə": "e",
    "ı": "i", "I": "i", "İ": "i", "i": "i",
    "ö": "o", "Ö": "o",
    "ü": "u", "Ü": "u",
    "ş": "s", "Ş": "s",
    "ç": "c", "Ç": "c",
    "ğ": "g", "Ğ": "g",
    # Cyrillic common in post-Soviet Baku grocery packaging
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}

# Reverse mapping for expanding common queries (e.g. 'sud' -> ['sud', 'süd'])
COMMON_EXPANSIONS = {
    "sud": "süd",
    "sudu": "südü",
    "corek": "çörək",
    "coreyi": "çörəyi",
    "yag": "yağ",
    "yagi": "yağı",
    "qatiq": "qatıq",
    "qatigi": "qatığı",
    "pendir": "pendir",
    "kesmik": "kəsmik",
    "qaymaq": "qaymaq",
    "xama": "xama",
    "duyu": "düyü",
    "cay": "çay",
    "cayi": "çayı",
    "qehve": "qəhvə",
    "seker": "şəkər",
    "et": "ət",
    "eti": "əti",
    "toyuq": "toyuq",
    "sparo": "spar",
    "almarket": "al market",
    "bazarstor": "bazarstore",
}


def fold_az_accents(text: str) -> str:
    """
    Folds Azerbaijani and non-ASCII characters into plain ASCII lowercase.
    E.g. 'Milla Süd 2.5%' -> 'milla sud 2.5%'
         'Kərə Yağı' -> 'kere yagi'
         'Çörək' -> 'corek'
    """
    if not text:
        return ""
    
    result = []
    for char in text:
        if char in AZ_CHAR_MAP:
            result.append(AZ_CHAR_MAP[char])
        else:
            result.append(char)
    
    transliterated = "".join(result)
    nfd = unicodedata.normalize("NFD", transliterated)
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return stripped.lower()


def clean_tokens(text: str) -> List[str]:
    """
    Splits text into alphanumeric normalized search tokens.
    """
    cleaned = re.sub(r"[^\w\s]", " ", fold_az_accents(text))
    return [t.strip() for t in cleaned.split() if len(t.strip()) > 0]


def get_query_variants(raw_query: str) -> Set[str]:
    """
    Generates a set of search variations for a user query.
    E.g., 'milla sud' -> {'milla', 'sud', 'süd', 'milla sud', 'milla süd'}
    """
    variants = set()
    raw = raw_query.strip().lower()
    if not raw:
        return variants

    variants.add(raw)
    folded = fold_az_accents(raw)
    variants.add(folded)

    tokens = clean_tokens(raw)
    for t in tokens:
        variants.add(t)
        if t in COMMON_EXPANSIONS:
            variants.add(COMMON_EXPANSIONS[t])

    variants.add(" ".join(tokens))
    return variants


def az_stem(word: str) -> str:
    """
    Stems common Azerbaijani noun and adjective inflections:
    - çörəyi / coreyi -> corek
    - qatığı / qatigi -> qatiq
    - yağı / yagi -> yag
    - südü / sudu -> sud
    - əti / eti -> et
    """
    w = fold_az_accents(word)
    if not w:
        return ""
    if w.endswith("yi") or w.endswith("ye"):
        return w[:-2] + "k"
    if w.endswith("gi") or w.endswith("gu") or w.endswith("qi"):
        return w[:-2] + "q"
    for suff in ("lar", "ler", "dan", "den", "nin", "nun", "si", "su"):
        if w.endswith(suff) and len(w) > len(suff) + 2:
            w = w[:-len(suff)]
    for suff in ("i", "u", "e", "a"):
        if w.endswith(suff) and len(w) > len(suff) + 2:
            w = w[:-len(suff)]
    return w


def matches_tokens(query: str, target_name: str, brand: str = "", barcode: str = "") -> bool:
    """
    Returns True if ALL tokens from the query match anywhere in target_name, brand, or barcode
    considering Azerbaijani transliterations and inflections.
    E.g.: query 'sud milla' matches target_name 'Milla Süd 2.5% 1L'.
          query 'corek' matches target_name 'Kənd Çörəyi 500g'.
          query 'ariel yuyucu' matches target_name 'Ariel Dağ Təravəti Avtomat Yuyucu Toz'.
    """
    if not query:
        return True

    q_tokens = clean_tokens(query)
    if not q_tokens:
        return True

    # If barcode matches directly
    folded_query = fold_az_accents(query).replace(" ", "")
    if barcode and folded_query in barcode:
        return True

    target_corpus = f"{target_name} {brand} {barcode}".lower()
    folded_corpus = fold_az_accents(target_corpus)
    corpus_words = clean_tokens(target_corpus)
    corpus_stems = [az_stem(w) for w in corpus_words]

    for q_tok in q_tokens:
        q_stem = az_stem(q_tok)

        # 1. Exact or folded substring match
        if q_tok in folded_corpus or q_stem in folded_corpus:
            continue
        
        # 2. Check stem match against corpus stems
        if any(q_stem == cs or (len(q_stem) >= 3 and (q_stem in cs or cs in q_stem)) for cs in corpus_stems):
            continue

        # 3. Check common expansion (e.g. 'sud' -> 'süd')
        expanded = COMMON_EXPANSIONS.get(q_tok)
        if expanded and (expanded in target_corpus or fold_az_accents(expanded) in folded_corpus):
            continue

        # 4. Fuzzy match against corpus words (for minor typos, e.g. 'sparo' -> 'spar')
        has_fuzzy = False
        for c_word in corpus_words:
            if c_word.startswith(q_tok) or q_tok.startswith(c_word):
                if min(len(c_word), len(q_tok)) >= 3:
                    has_fuzzy = True
                    break
            if SequenceMatcher(None, q_tok, c_word).ratio() >= 0.72:
                has_fuzzy = True
                break

        if not has_fuzzy:
            return False

    return True


def calculate_relevance(query: str, product_name: str, brand: str, barcode: str) -> float:
    """
    Calculates a relevance score (0.0 to 100.0) for sorting search results.
    Exact name match > Prefix match > Multi-token intersection > Fuzzy match.
    """
    score = 0.0
    q_folded = fold_az_accents(query.strip())
    name_folded = fold_az_accents(product_name.strip())
    brand_folded = fold_az_accents(brand.strip() if brand else "")

    if barcode and query.strip() == barcode.strip():
        return 100.0

    if q_folded == name_folded:
        return 95.0

    if name_folded.startswith(q_folded):
        score += 80.0
    elif q_folded in name_folded:
        score += 65.0

    if brand_folded and q_folded in brand_folded:
        score += 50.0

    q_tokens = clean_tokens(query)
    name_tokens = set(clean_tokens(product_name))
    matched_tokens = sum(1 for t in q_tokens if t in name_tokens or any(t in nt for nt in name_tokens))
    if q_tokens:
        token_ratio = matched_tokens / len(q_tokens)
        score += token_ratio * 30.0

    ratio = SequenceMatcher(None, q_folded, name_folded).ratio()
    score += ratio * 20.0

    return score
