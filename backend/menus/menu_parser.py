#############################
### IMPORTS AND CONSTANTS ###
#############################

import re
import attr
import datetime
from typing import Dict, List, Literal, Optional
from docx import Document
from django.core.files.uploadedfile import UploadedFile

WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]
TAG_MATCH = r"\s?\(\s?(V|Veg|GF|D|N|Vegetarian|Vegan|Contains Nuts)\s?\)"
EMDASH = b"\xe2\x80\x93"
EXCEPTIONS = [
    "No Meal",
    "---",
    "No Diner",
    "Winter Break",
    "Breakfast Served",
    "Lunch Served",
    "Service",
    "Kitchen Closed",
    "Lawn Parties",
    "2017",
    "Formal",
    "2019",
    "2018",
    "2016",
    "2015",
    "2014",
]

#################
### FUNCTIONS ###
#################


def get_standardized_tags(tags: List[str]) -> List[str]:
    def simplify(tag: str) -> str:
        tag_to_category: Dict[str, str] = {
            "V": "Vegan",
            "Veg": "Vegetarian",
            "GF": "Gluten-Free",
            "N": "Nuts",
            "Contains Nuts": "Nuts",
            "D": "Dairy",
        }
        return tag_to_category.get(tag, tag)

    return list(map(simplify, tags))


DishType = Literal["soup", "entree", "side", "dessert"]


def count2course(idx: int) -> DishType:
    if idx == 1:
        return "soup"
    elif idx in range(2, 5):
        return "entree"
    elif idx in range(5, 8):
        return "side"
    return "dessert"


def is_valid_dish(line: str) -> bool:
    line = line.strip()
    if len(line) == 0:  # empty lines GENERALLY separate days
        return False
    if any([word in line for word in EXCEPTIONS]):
        return False
    return True


def extract_name(line: str) -> str:
    line = (
        line.replace("w.", "with ")
        .replace("  ", " ")
        .replace("&", "and")
        .replace("*", "")
    )
    return re.sub(TAG_MATCH, "", line).strip()


def clean_theme(encoding: bytes) -> str:
    theme = encoding.split(EMDASH)[-1].strip().decode("utf-8").strip()
    if "patrick" in theme:
        theme = "irish"
    elif any(
        [
            event in theme
            for event in ["soph", "lawn", "formal", "choice", "fine"]
        ]
    ):
        theme = "EVENT"
    elif theme == "vive la france":
        theme = "french"

    return re.sub(
        r"night|nite|dinner|!|oktoberfest|day|style|family|", "", theme.lower()
    ).strip()


@attr.s(auto_attribs=True)
class Dish:
    course: str
    tags: List[str]
    name: str


@attr.s(auto_attribs=True)
class MenuData:
    weekday: str
    date: datetime.date
    dishes: List[Dish] = []
    theme: Optional[str] = None


# TODO: figure out how to transfer django request.FILES object
# into an IO buffer that can be piped (through this context manager)
# into the python-docx parsing
def parse_data_from_menu_document(file: UploadedFile, date: datetime.date):
    doc = Document(file)
    text = list(map(lambda p: p.text, doc.paragraphs))
    return _data_builder(text, date)


def _data_builder(text: List[str], date_=str) -> List[MenuData]:

    date = datetime.datetime.strptime(date_, "%Y-%m-%d").date()

    in_day = False  # is line a dish or just random text (start/default)
    dish_idx = 0  # line number beneath the day of the week subtitle
    data: List[MenuData] = []  # data object being built!

    # build data structure line by line in document
    for line in text:
        if not in_day:
            which_day = list(map(lambda day: line.startswith(day), WEEKDAYS))
            is_new_day = any(which_day)
            if is_new_day:
                in_day, dish_idx, day = (True, 1, which_day.index(True))
                data.append(
                    MenuData(
                        weekday=WEEKDAYS[day],
                        date=date + datetime.timedelta(days=day),
                    )
                )
                if EMDASH in (encoding := line.encode("utf-8")):
                    data[-1].theme = clean_theme(encoding)
        else:
            is_dish = is_valid_dish(line)
            if not is_dish:
                in_day = False
                continue
            dish_course = count2course(dish_idx)
            dish_idx += 1
            data[-1].dishes.append(
                Dish(
                    course=dish_course,
                    tags=get_standardized_tags(re.findall(TAG_MATCH, line)),
                    name=extract_name(line),
                )
            )
            if dish_idx == 9:
                in_day = False

    return data
