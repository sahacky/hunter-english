#!/usr/bin/env python3
"""Сборка пилотного контента ранга E — модуль E1 (E-01…E-05), plan://M5#5.4.

Вход: фразовые пулы ниже (ручная курация по specs/01 §5 + шаблон урока specs/02 §2),
цитаты из data/quotes/*.json (est_rank E).
Выход:
  data/phrases/phrases-e.json      — фразы (specs/05 §2)
  data/lessons/exercises-e.json    — упражнения (specs/05 §3), авто-вывод из фраз
  data/lessons/lessons-e.json      — уроки (specs/05 §4)
  data/raw/phrase_audio_e1.tsv     — список "id<TAB>текст" для gen_audio.py

Детерминированность: random.Random(SEED) — пересборка даёт те же файлы.
Нумерация: ph-e-NNNN и ex-e-NNNN сквозная в порядке уроков.
"""
import json
import random
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "data"
SEED = 20260928

# --------------------------------------------------------------------------
# Пулы фраз: (text_en, translation_ru, variants|None)
# --------------------------------------------------------------------------
E01 = [
    ("Hello!", "Привет!", None),
    ("Hi!", "Привет!", None),
    ("Good morning!", "Доброе утро!", None),
    ("Good afternoon!", "Добрый день!", None),
    ("Good evening!", "Добрый вечер!", None),
    ("Good night!", "Доброй ночи!", None),
    ("Nice to meet you.", "Приятно познакомиться.", None),
    ("See you later.", "До встречи.", None),
    ("Welcome to Moscow.", "Добро пожаловать в Москву.", None),
    ("I am Ivan.", "Я Иван.", None),
    ("My name is Anna.", "Меня зовут Анна.", None),
    ("I am from Russia.", "Я из России.", None),
    ("She is from Japan.", "Она из Японии.", None),
    ("He is from Canada.", "Он из Канады.", None),
    ("We are from Russia.", "Мы из России.", None),
    ("They are from Spain.", "Они из Испании.", None),
    ("You are my friend.", "Ты мой друг.", None),
    ("We are friends.", "Мы друзья.", None),
    ("They are students.", "Они студенты.", None),
    ("I am new here.", "Я здесь новенький.", None),
    ("This is my friend.", "Это мой друг.", None),
    ("This is Anna.", "Это Анна.", None),
    ("He is Ivan.", "Он Иван.", None),
    ("She is Anna.", "Она Анна.", None),
    ("It is late.", "Уже поздно.", None),
    ("It is okay.", "Всё в порядке.", None),
    ("Everything is fine.", "Всё хорошо.", None),
    ("I am fine, thanks.", "Я в порядке, спасибо.", None),
    ("I am okay.", "Я в порядке.", None),
    ("You are right.", "Ты прав.", None),
    ("You are wrong.", "Ты не прав.", None),
    ("I am here.", "Я здесь.", None),
    ("We are here.", "Мы здесь.", None),
    ("They are here.", "Они здесь.", None),
    ("I am ready.", "Я готов.", None),
    ("You are late.", "Ты опаздываешь.", None),
    ("Life is good.", "Жизнь хороша.", None),
    ("My English is basic.", "Мой английский базовый.", None),
    ("I am 25 years old.", "Мне 25 лет.", None),
    ("I am glad to be here.", "Я рад быть здесь.", None),
    ("Moscow is my city.", "Москва — мой город.", None),
    ("Russia is my country.", "Россия — моя страна.", None),
    ("Thank you very much.", "Большое спасибо.", None),
]

E02 = [
    ("I am a student.", "Я студент.", None),
    ("I am a teacher.", "Я учитель.", None),
    ("He is a doctor.", "Он врач.", None),
    ("She is a doctor.", "Она врач.", None),
    ("I am an engineer.", "Я инженер.", None),
    ("She is an artist.", "Она художница.", None),
    ("He is a good doctor.", "Он хороший врач.", None),
    ("It is a big city.", "Это большой город.", None),
    ("It is a small town.", "Это маленький город.", None),
    ("This is a good idea.", "Это хорошая идея.", None),
    ("It is a bad idea.", "Это плохая идея.", None),
    ("I am busy.", "Я занят.", None),
    ("I am free today.", "Я сегодня свободен.", None),
    ("This city is big.", "Этот город большой.", None),
    ("This coffee is good.", "Этот кофе хороший.", None),
    ("My city is beautiful.", "Мой город красивый.", None),
    ("My friend is funny.", "Мой друг весёлый.", None),
    ("I am happy.", "Я счастлив.", None),
    ("I am sad.", "Мне грустно.", None),
    ("He is angry.", "Он злится.", None),
    ("She is kind.", "Она добрая.", None),
    ("It is cold today.", "Сегодня холодно.", None),
    ("It is hot today.", "Сегодня жарко.", None),
    ("It is easy.", "Это легко.", None),
    ("It is difficult.", "Это сложно.", None),
    ("English is easy.", "Английский лёгкий.", None),
    ("My phone is old.", "Мой телефон старый.", None),
    ("My phone is new.", "Мой телефон новый.", None),
    ("We are ready.", "Мы готовы.", None),
    ("You are beautiful.", "Ты красивая.", None),
    ("He is a good friend.", "Он хороший друг.", None),
    ("I am an only child.", "Я единственный ребёнок.", None),
    ("It is an apple.", "Это яблоко.", None),
    ("It is an old house.", "Это старый дом.", None),
    ("It is a new house.", "Это новый дом.", None),
    ("I have a brother.", "У меня есть брат.", None),
    ("I have a sister.", "У меня есть сестра.", None),
    ("I have a question.", "У меня есть вопрос.", None),
    ("I have an idea.", "У меня есть идея.", None),
    ("You are a good student.", "Ты хороший студент.", None),
    ("It is a secret.", "Это секрет.", None),
    ("I am serious.", "Я серьёзен.", None),
    ("This is an emergency.", "Это чрезвычайная ситуация.", None),
]

E03 = [
    ("I am not a teacher.", "Я не учитель.", None),
    ("I am not a doctor.", "Я не врач.", None),
    ("He is not a doctor.", "Он не врач.", None),
    ("She is not a student.", "Она не студентка.", None),
    ("It is not true.", "Это неправда.", None),
    ("It is not a problem.", "Это не проблема.", None),
    ("It is not easy.", "Это нелегко.", None),
    ("It is not difficult.", "Это несложно.", None),
    ("This is not my phone.", "Это не мой телефон.", None),
    ("This is not my room.", "Это не моя комната.", None),
    ("I am not busy.", "Я не занят.", None),
    ("I am not tired.", "Я не устал.", None),
    ("He is not here.", "Его здесь нет.", None),
    ("She is not here.", "Её здесь нет.", None),
    ("They are not here.", "Их здесь нет.", None),
    ("We are not ready.", "Мы не готовы.", None),
    ("You are not right.", "Ты не прав.", None),
    ("You are not wrong.", "Ты и не ошибаешься.", None),
    ("My mother is a teacher.", "Моя мама — учительница.", None),
    ("My father is a doctor.", "Мой папа — врач.", None),
    ("My brother is a student.", "Мой брат — студент.", None),
    ("My sister is an artist.", "Моя сестра — художница.", None),
    ("My parents are doctors.", "Мои родители — врачи.", None),
    ("My family is big.", "Моя семья большая.", None),
    ("My family is not big.", "Моя семья небольшая.", None),
    ("I have no brothers.", "У меня нет братьев.", None),
    ("I am not from Moscow.", "Я не из Москвы.", None),
    ("He is not from Russia.", "Он не из России.", None),
    ("We are not late.", "Мы не опаздываем.", None),
    ("It is not cold today.", "Сегодня не холодно.", None),
    ("It is not hot.", "Не жарко.", None),
    ("I am not angry.", "Я не злой.", None),
    ("She is not sad.", "Она не грустит.", None),
    ("My name is not Anna.", "Меня зовут не Анна.", None),
    ("This is not a good idea.", "Это не лучшая идея.", None),
    ("Money is not a problem.", "Деньги — не проблема.", None),
    ("I am not sure.", "Я не уверен.", None),
    ("It is not far.", "Это недалеко.", None),
    ("It is not expensive.", "Это недорого.", None),
    ("We are not from Spain.", "Мы не из Испании.", None),
    ("They are not friends.", "Они не друзья.", None),
    ("My mother is not old.", "Моя мама не старая.", None),
    ("I am not ready.", "Я не готов.", None),
    ("Sorry, we are not open.", "Извините, мы закрыты.", None),
]

E04 = [
    ("Are you Ivan?", "Ты Иван?", None),
    ("Are you a student?", "Ты студент?", None),
    ("Are you a doctor?", "Ты врач?", None),
    ("Are you from Russia?", "Ты из России?", None),
    ("Are you from Moscow?", "Ты из Москвы?", None),
    ("Are you busy?", "Ты занят?", None),
    ("Are you tired?", "Ты устал?", None),
    ("Are you hungry?", "Ты голоден?", None),
    ("Are you thirsty?", "Ты хочешь пить?", None),
    ("Are you happy?", "Ты счастлив?", None),
    ("Are you okay?", "Ты в порядке?", None),
    ("Are you ready?", "Ты готов?", None),
    ("Are you sure?", "Ты уверен?", None),
    ("Are you cold?", "Тебе холодно?", None),
    ("Are you free today?", "Ты сегодня свободен?", None),
    ("Is he your friend?", "Он твой друг?", None),
    ("Is she your sister?", "Она твоя сестра?", None),
    ("Is it true?", "Это правда?", None),
    ("Is it far?", "Это далеко?", None),
    ("Is it expensive?", "Это дорого?", None),
    ("Is it okay?", "Это нормально?", None),
    ("Is this your phone?", "Это твой телефон?", None),
    ("Is that a problem?", "Это проблема?", None),
    ("Am I right?", "Я прав?", None),
    ("Am I late?", "Я опаздываю?", None),
    ("Are we late?", "Мы опаздываем?", None),
    ("Are they here?", "Они здесь?", None),
    ("Are your parents here?", "Твои родители здесь?", None),
    ("Is your mother a teacher?", "Твоя мама учительница?", None),
    ("Yes, I am.", "Да.", None),
    ("No, I am not.", "Нет.", None),
    ("Yes, he is.", "Да.", None),
    ("No, she is not.", "Нет.", None),
    ("Yes, we are.", "Да.", None),
    ("No, they are not.", "Нет.", None),
    ("Yes, it is.", "Да.", None),
    ("No, it is not.", "Нет.", None),
    ("I am hungry.", "Я голоден.", None),
    ("I am thirsty.", "Я хочу пить.", None),
    ("I am tired.", "Я устал.", None),
    ("She is tired, but she is happy.", "Она устала, но счастлива.", None),
    ("Excuse me, are you Anna?", "Извините, вы Анна?", None),
    ("Are you open?", "Вы работаете?", None),
    ("Is it a good idea?", "Это хорошая идея?", None),
]

E05 = [
    ("How are you?", "Как дела?", None),
    ("How is it going?", "Как дела?", None),
    ("I am fine, thank you.", "Хорошо, спасибо.", None),
    ("I am very well, thanks.", "Отлично, спасибо.", None),
    ("Not bad.", "Неплохо.", None),
    ("So-so.", "Так себе.", None),
    ("And you?", "А ты?", None),
    ("What is your name?", "Как тебя зовут?", None),
    ("Good to see you.", "Рад тебя видеть.", None),
    ("Long time no see.", "Давно не виделись.", None),
    ("Have a good day.", "Хорошего дня.", None),
    ("It is nice here.", "Здесь приятно.", None),
    ("I am from Russia, and you?", "Я из России, а ты?", None),
    ("My name is Ivan. What is your name?", "Меня зовут Иван. Как тебя зовут?", None),
    ("Are you new here?", "Ты здесь новенький?", None),
    ("Is your family big?", "Твоя семья большая?", None),
    ("My family is not big.", "Моя семья небольшая.", None),
    ("This is my mother.", "Это моя мама.", None),
    ("This is my friend Dima.", "Это мой друг Дима.", None),
    ("Hello, my name is Anna. I am from Kazan.", "Здравствуй, меня зовут Анна. Я из Казани.", None),
    ("I am not a teacher, I am a doctor.", "Я не учитель, я врач.", None),
    ("Is your brother a student?", "Твой брат студент?", None),
    ("Yes, he is a student.", "Да, он студент.", None),
    ("No, he is not a student, he is a doctor.", "Нет, он не студент, он врач.", None),
    ("I am not hungry, I am thirsty.", "Я не голоден, я хочу пить.", None),
    ("It is not expensive, it is cheap.", "Это недорого, это дёшево.", None),
    ("My phone is old, but it is okay.", "Мой телефон старый, но с ним всё в порядке.", None),
    ("Today is good.", "Сегодня хороший день.", None),
    ("I am happy today.", "Я сегодня счастлив.", None),
    ("We are tired, but we are happy.", "Мы устали, но довольны.", None),
    ("Is Moscow big?", "Москва большая?", None),
    ("Yes, it is big and beautiful.", "Да, большая и красивая.", None),
    ("Are you sure it is true?", "Ты уверен, что это правда?", None),
    ("It is a secret.", "Это секрет.", None),
    ("Life is not easy, but it is interesting.", "Жизнь непроста, но интересна.", None),
    ("My city is old and beautiful.", "Мой город старый и красивый.", None),
    ("Is your sister an artist?", "Твоя сестра художница?", None),
    ("No, she is an engineer.", "Нет, она инженер.", None),
    ("Are your friends students?", "Твои друзья студенты?", None),
    ("Yes, they are.", "Да.", None),
    ("No, they are not.", "Нет.", None),
    ("Is it far from here?", "Это далеко отсюда?", None),
    ("I am here with my friend.", "Я здесь с другом.", None),
    ("Everything is okay.", "Всё в порядке.", None),
]


E06 = [
    ("What is your name?", "Как тебя зовут?", None),
    ("What is his name?", "Как его зовут?", None),
    ("Where are you from?", "Откуда ты?", None),
    ("Where is he from?", "Откуда он?", None),
    ("How are you?", "Как дела?", None),
    ("How is your mother?", "Как твоя мама?", None),
    ("How old are you?", "Сколько тебе лет?", None),
    ("How old is your brother?", "Сколько лет твоему брату?", None),
    ("Who is she?", "Кто она?", None),
    ("Who is that man?", "Кто тот мужчина?", None),
    ("What is this?", "Что это?", None),
    ("What is it?", "Что это?", None),
    ("Where is my phone?", "Где мой телефон?", None),
    ("Where are my keys?", "Где мои ключи?", None),
    ("Where is the station?", "Где вокзал?", None),
    ("Where is Anna from?", "Откуда Анна?", None),
    ("What is your city like?", "Какой у тебя город?", None),
    ("My name is Ivan. What is your name?", "Меня зовут Иван. А как тебя зовут?", None),
    ("I am from Kazan. Where are you from?", "Я из Казани. А ты откуда?", None),
    ("She is my sister. Her name is Olga.", "Она моя сестра. Её зовут Ольга.", None),
    ("He is my friend. His name is Dima.", "Он мой друг. Его зовут Дима.", None),
    ("It is a big question.", "Это большой вопрос.", None),
    ("Where is the toilet, please?", "Где туалет, пожалуйста?", None),
    ("What is your phone number?", "Какой у тебя номер телефона?", None),
    ("How much is it?", "Сколько это стоит?", None),
    ("How is it going?", "Как дела?", None),
    ("What is the problem?", "В чём проблема?", None),
    ("Where are they from?", "Откуда они?", None),
    ("Who are you?", "Кто ты?", None),
    ("Who is your teacher?", "Кто твой учитель?", None),
    ("What are their names?", "Как их зовут?", None),
    ("Where is your family?", "Где твоя семья?", None),
    ("How old is your sister?", "Сколько лет твоей сестре?", None),
    ("My brother is ten years old.", "Моему брату десять лет.", None),
    ("I am twenty-five years old.", "Мне двадцать пять лет.", None),
    ("Where is Moscow?", "Где Москва?", None),
    ("Moscow is in Russia.", "Москва в России.", None),
    ("London is in England.", "Лондон в Англии.", None),
    ("What is the answer?", "Какой ответ?", None),
    ("Where is my bag?", "Где моя сумка?", None),
    ("How is the weather?", "Как погода?", None),
    ("The weather is good today.", "Погода сегодня хорошая.", None),
    ("What is your favourite colour?", "Какой твой любимый цвет?", None),
    ("Why are you here?", "Почему ты здесь?", None),
]

E07 = [
    ("This is my phone.", "Это мой телефон.", None),
    ("This is your key.", "Это твой ключ.", None),
    ("That is my house.", "То мой дом.", None),
    ("That is your car.", "То твоя машина.", None),
    ("These are my friends.", "Это мои друзья.", None),
    ("These are our books.", "Это наши книги.", None),
    ("Those are her shoes.", "То её туфли.", None),
    ("Those are his glasses.", "То его очки.", None),
    ("Is this your bag?", "Это твоя сумка?", None),
    ("Is this a pen?", "Это ручка?", None),
    ("Is that your car?", "То твоя машина?", None),
    ("Are these your keys?", "Это твои ключи?", None),
    ("Are those our tickets?", "То наши билеты?", None),
    ("This is not my umbrella.", "Это не мой зонт.", None),
    ("That is not her phone.", "То не её телефон.", None),
    ("These are not my shoes.", "Это не мои туфли.", None),
    ("This table is old.", "Этот стол старый.", None),
    ("That chair is new.", "Тот стул новый.", None),
    ("This window is open.", "Это окно открыто.", None),
    ("That door is closed.", "Та дверь закрыта.", None),
    ("This city is beautiful.", "Этот город красивый.", None),
    ("That building is tall.", "То здание высокое.", None),
    ("This coffee is hot.", "Этот кофе горячий.", None),
    ("That tea is cold.", "Тот чай холодный.", None),
    ("This is my friend Dima.", "Это мой друг Дима.", None),
    ("These are my parents.", "Это мои родители.", None),
    ("This is our room.", "Это наш номер.", None),
    ("Those are tourists.", "То туристы.", None),
    ("This bag is heavy.", "Эта сумка тяжёлая.", None),
    ("These apples are red.", "Эти яблоки красные.", None),
    ("What is this?", "Что это?", None),
    ("What are these?", "Что это?", None),
    ("This is important.", "Это важно.", None),
    ("That is a good idea.", "То хорошая идея.", None),
    ("These are my things.", "Это мои вещи.", None),
    ("Is this seat free?", "Это место свободно?", None),
    ("This is for you.", "Это для тебя.", None),
    ("That is strange.", "Это странно.", None),
    ("This is my life.", "Это моя жизнь.", None),
    ("These shoes are new.", "Эти туфли новые.", None),
    ("That house is big.", "Тот дом большой.", None),
    ("This is the best day!", "Это лучший день!", None),
    ("Those people are kind.", "Те люди добрые.", None),
    ("Is this your first time here?", "Ты здесь впервые?", None),
]

E08 = [
    ("His name is Dima.", "Его зовут Дима.", None),
    ("Her name is Anna.", "Её зовут Анна.", None),
    ("His phone is new.", "Его телефон новый.", None),
    ("Her car is old.", "Её машина старая.", None),
    ("My brother is a doctor.", "Мой брат — врач.", None),
    ("Her sister is an artist.", "Её сестра — художница.", None),
    ("His parents are here.", "Его родители здесь.", None),
    ("Their house is big.", "Их дом большой.", None),
    ("Our room is small.", "Наш номер маленький.", None),
    ("Its colour is red.", "Её цвет — красный.", None),
    ("He is my best friend.", "Он мой лучший друг.", None),
    ("She is our teacher.", "Она наша учительница.", None),
    ("It is their cat.", "Это их кот.", None),
    ("We are their guests.", "Мы их гости.", None),
    ("They are my neighbours.", "Они мои соседи.", None),
    ("This is Dima's sister.", "Это сестра Димы.", None),
    ("This is Anna's phone.", "Это телефон Анны.", None),
    ("That is my father's car.", "То машина моего отца.", None),
    ("Where is Ivan's bag?", "Где сумка Ивана?", None),
    ("It is Olga's key.", "Это ключ Ольги.", None),
    ("My sister's name is Kate.", "Мою сестру зовут Катя.", None),
    ("His friend's car is black.", "Машина его друга чёрная.", None),
    ("I have one brother and two sisters.", "У меня один брат и две сестры.", None),
    ("She has three children.", "У неё трое детей.", None),
    ("He is twelve years old.", "Ему двенадцать лет.", None),
    ("I am sixteen.", "Мне шестнадцать.", None),
    ("My father is fifty.", "Моему отцу пятьдесят.", None),
    ("How old is he?", "Сколько ему лет?", None),
    ("How old is your daughter?", "Сколько лет твоей дочери?", None),
    ("Five plus five is ten.", "Пять плюс пять — десять.", None),
    ("It is fifteen.", "Сейчас пятнадцать.", None),
    ("Room seven is on this floor.", "Седьмой номер на этом этаже.", None),
    ("Her eyes are green.", "У неё зелёные глаза.", None),
    ("His hands are cold.", "У него холодные руки.", None),
    ("Our friends are kind.", "Наши друзья добрые.", None),
    ("Their names are Ivan and Olga.", "Их зовут Иван и Ольга.", None),
    ("My mother's name is Tanya.", "Мою маму зовут Таня.", None),
    ("Is she your sister?", "Она твоя сестра?", None),
    ("Is he your friend?", "Он твой друг?", None),
    ("Are they your parents?", "Это твои родители?", None),
    ("It is not my dog.", "Это не моя собака.", None),
    ("He is not her brother.", "Он не её брат.", None),
    ("Your tea is ready.", "Твой чай готов.", None),
    ("Their dog is friendly.", "Их собака дружелюбная.", None),
]

E09 = [
    ("One book, two books.", "Одна книга, две книги.", None),
    ("I have two apples.", "У меня два яблока.", None),
    ("I have three children.", "У меня трое детей.", None),
    ("These are my books.", "Это мои книги.", None),
    ("Those are her keys.", "То её ключи.", None),
    ("The men are here.", "Мужчины здесь.", None),
    ("The women are tired.", "Женщины устали.", None),
    ("The children are happy.", "Дети счастливы.", None),
    ("These people are tourists.", "Эти люди — туристы.", None),
    ("My feet are cold.", "У меня мёрзнут ноги.", None),
    ("My teeth are white.", "У меня белые зубы.", None),
    ("How many books do you have?", "Сколько у тебя книг?", None),
    ("I have ten fingers.", "У меня десять пальцев.", None),
    ("Twenty, thirty, forty.", "Двадцать, тридцать, сорок.", None),
    ("It is twenty dollars.", "Это двадцать долларов.", None),
    ("It costs fifty euros.", "Это стоит пятьдесят евро.", None),
    ("I have a hundred rubles.", "У меня сто рублей.", None),
    ("My room number is sixty.", "Мой номер комнаты — шестьдесят.", None),
    ("Two cities, three countries.", "Два города, три страны.", None),
    ("These cities are big.", "Эти города большие.", None),
    ("Those boxes are heavy.", "Те коробки тяжёлые.", None),
    ("My glasses are on the table.", "Мои очки на столе.", None),
    ("The buses are slow.", "Автобусы медленные.", None),
    ("We have two watches.", "У нас двое часов.", None),
    ("Apples are red or green.", "Яблоки красные или зелёные.", None),
    ("Bananas are yellow.", "Бананы жёлтые.", None),
    ("I like tomatoes.", "Я люблю помидоры.", None),
    ("These oranges are sweet.", "Эти апельсины сладкие.", None),
    ("Water and bread.", "Вода и хлеб.", None),
    ("Milk is white.", "Молоко белое.", None),
    ("I want two teas, please.", "Два чая, пожалуйста.", None),
    ("One coffee or two coffees?", "Один кофе или два?", None),
    ("The children are at school.", "Дети в школе.", None),
    ("The men are at work.", "Мужчины на работе.", None),
    ("My friends are students.", "Мои друзья студенты.", None),
    ("There are two windows.", "Тут два окна.", None),
    ("How many people are here?", "Сколько здесь людей?", None),
    ("Five days a week.", "Пять дней в неделю.", None),
    ("Seven days, seven nights.", "Семь дней, семь ночей.", None),
    ("Twelve months in a year.", "Двенадцать месяцев в году.", None),
    ("Two tickets to London.", "Два билета до Лондона.", None),
    ("Three rooms and two bathrooms.", "Три комнаты и две ванные.", None),
    ("Is this a pigeon?", "Это голубь?", None),
    ("These are not my glasses.", "Это не мои очки.", None),
]

E10 = [
    ("What is your name and where are you from?", "Как тебя зовут и откуда ты?", None),
    ("My name is Olga. I am from Moscow.", "Меня зовут Ольга. Я из Москвы.", None),
    ("This is my friend. His name is Ivan.", "Это мой друг. Его зовут Иван.", None),
    ("These are my keys.", "Это мои ключи.", None),
    ("Those are her books.", "То её книги.", None),
    ("His sister is ten years old.", "Его сестре десять лет.", None),
    ("Her brothers are students.", "Её братья студенты.", None),
    ("Our children are at school.", "Наши дети в школе.", None),
    ("Their house has five rooms.", "В их доме пять комнат.", None),
    ("Where is Anna's phone?", "Где телефон Анны?", None),
    ("This is Dima's book.", "Это книга Димы.", None),
    ("How old is your father?", "Сколько лет твоему отцу?", None),
    ("What are these?", "Что это?", None),
    ("Who are those people?", "Кто те люди?", None),
    ("The men are from Canada.", "Мужчины из Канады.", None),
    ("The women are teachers.", "Женщины — учительницы.", None),
    ("Is this your bag? — Yes, it is.", "Это твоя сумка? — Да.", None),
    ("Are those your glasses? — No, they are not.", "То твои очки? — Нет.", None),
    ("It is thirty dollars.", "Это тридцать долларов.", None),
    ("I have two phones.", "У меня два телефона.", None),
    ("My city is old and beautiful.", "Мой город старый и красивый.", None),
    ("His car is black.", "Его машина чёрная.", None),
    ("Her eyes are blue.", "У неё голубые глаза.", None),
    ("Our friends are here.", "Наши друзья здесь.", None),
    ("What is it?", "Что это?", None),
    ("Where are the children?", "Где дети?", None),
    ("How is your family?", "Как твоя семья?", None),
    ("This tea is cold.", "Этот чай холодный.", None),
    ("Those windows are open.", "Те окна открыты.", None),
    ("My name is Anna. And what is your name?", "Меня зовут Анна. А как тебя?", None),
    ("I am from Russia. Where are you from?", "Я из России. Откуда ты?", None),
    ("She is twenty years old.", "Ей двадцать лет.", None),
    ("He is my sister's friend.", "Он друг моей сестры.", None),
    ("We have four chairs and one table.", "У нас четыре стула и один стол.", None),
    ("The station is far.", "Вокзал далеко.", None),
    ("This is room twelve.", "Это двенадцатый номер.", None),
    ("Those are not tourists.", "Те люди — не туристы.", None),
    ("His friends are doctors.", "Его друзья врачи.", None),
    ("Her tea is hot.", "Её чай горячий.", None),
    ("It is a big city with old streets.", "Это большой город со старыми улицами.", None),
    ("Two coffees and one tea, please.", "Два кофе и один чай, пожалуйста.", None),
    ("My parents are at home.", "Мои родители дома.", None),
    ("Where is your teacher from?", "Откуда твой учитель?", None),
    ("Everything is fine.", "Всё в порядке.", None),
    ("It is good to see you!", "Рад тебя видеть!", None),
]


RULE_E06 = """Спецвопрос с to be: вопросительное слово + am/is/are.

- **What** is your name? — что/как
- **Where** are you from? — где/откуда
- **How** old are you? — как (сколько лет)
- **Who** is she? — кто

Порядок слов: вопросительное слово → глагол → подлежащее. Без to be вопрос не строится."""

RULE_E07 = """Указательные местоимения:

- **this / these** — близко: This is my phone. These are my keys.
- **that / those** — далеко: That is your house. Those are her shoes.

Единственное — this/that, множественное — these/those."""

RULE_E08 = """Притяжательные: **my, your, his, her, its, our, their** — чей.

- His name is Dima. Her sister is an artist.
- Притяжательный падеж: **Dima's sister** = сестра Димы ('s).

Возраст: I am 25. My brother is 14."""

RULE_E09 = """Множественное число:

- Большинство: +**s** — books, keys, apples.
- После шипящих: +**es** — boxes, buses.
- Особые: **men, women, children, people, feet, teeth**.

Множественное без артикля: These are books. Числа: twenty, thirty... a hundred."""

RULE_E10 = """Повторение E-06...E-09 — коротко:

- **Wh-вопросы**: What/Where/How/Who + is/are.
- **this/these/that/those** — близко/далеко, ед./мн. число.
- **Притяжательные**: my/his/her/their + Dima's sister.
- **Множественное**: +s/-es; men, women, children — особые."""

RULE_E11 = """Present Simple — утверждение: подлежащее + глагол в начальной форме.

- **I / we / you / they** work, live, know, want, like.
- I work in an office. They live in London.

Повседневные, регулярные действия. Глагол не меняется для I/we/you/they."""

RULE_E12 = """Present Simple с he / she / it: глагол получает **-s**.

- He work**s** in a bank. She live**s** in Paris. It open**s** at nine.
- После шипящих: -es (watches, goes); y → ies (studies).

⚠️ Ловушка ЛТ-03: «He live here» — нельзя! He live**s** here."""

RULE_E13 = """Отрицание Present Simple: **don't** + глагол.

- I / we / you / they **don't** work. I don't know. We don't understand.

⚠️ Ловушка ЛТ-04: «I no speak English» — нельзя! I **don't** speak English."""

RULE_E14 = """Отрицание с he / she / it: **doesn't** + глагол БЕЗ -s.

- He doesn't work. She doesn't know. It doesn't work.
- Ошибка: «He doesn't works» — после doesn't глагол чистый.

Закрепление ЛТ-03/ЛТ-04: does + чистый глагол, don't + чистый глагол."""

RULE_E15 = """Повторение E-11…E-14 — коротко:

- **+**: I work. He work**s**.
- **−**: I **don't** work. He **doesn't** work (глагол без -s!).
- Экстренные фразы: Help! I'm lost. I don't understand. Where is the police station?

Контрольная-тренировка: найди ошибку + поставь время."""




E11 = [
    ("I work in an office.", "Я работаю в офисе.", None),
    ("I live in Moscow.", "Я живу в Москве.", None),
    ("I know English.", "Я знаю английский.", None),
    ("I want a coffee.", "Я хочу кофе.", None),
    ("I like this city.", "Мне нравится этот город.", None),
    ("I need help.", "Мне нужна помощь.", None),
    ("I speak Russian.", "Я говорю по-русски.", None),
    ("I understand you.", "Я тебя понимаю.", None),
    ("We work every day.", "Мы работаем каждый день.", None),
    ("We live in Russia.", "Мы живём в России.", None),
    ("We know this place.", "Мы знаем это место.", None),
    ("We want to see the city.", "Мы хотим посмотреть город.", None),
    ("We like tea.", "Мы любим чай.", None),
    ("You work a lot.", "Ты много работаешь.", None),
    ("You live here.", "Ты живёшь здесь.", None),
    ("You know the answer.", "Ты знаешь ответ.", None),
    ("You want a ticket.", "Ты хочешь билет.", None),
    ("You like coffee.", "Ты любишь кофе.", None),
    ("They work together.", "Они работают вместе.", None),
    ("They live in London.", "Они живут в Лондоне.", None),
    ("They know my brother.", "Они знают моего брата.", None),
    ("They want to help.", "Они хотят помочь.", None),
    ("They like music.", "Они любят музыку.", None),
    ("I want to learn English.", "Я хочу выучить английский.", None),
    ("I like to read books.", "Я люблю читать книги.", None),
    ("I work from home.", "Я работаю из дома.", None),
    ("I live with my family.", "Я живу с семьёй.", None),
    ("We want to travel.", "Мы хотим путешествовать.", None),
    ("We need a plan.", "Нам нужен план.", None),
    ("We understand the rules.", "Мы понимаем правила.", None),
    ("You need a ticket.", "Тебе нужен билет.", None),
    ("You speak fast.", "Ты говоришь быстро.", None),
    ("They need money.", "Им нужны деньги.", None),
    ("They speak English.", "Они говорят по-английски.", None),
    ("I know this song.", "Я знаю эту песню.", None),
    ("I like your name.", "Мне нравится твоё имя.", None),
    ("We like this hotel.", "Нам нравится этот отель.", None),
    ("I want to stay here.", "Я хочу остаться здесь.", None),
    ("People need water.", "Людям нужна вода.", None),
    ("I live near the park.", "Я живу возле парка.", None),
    ("We work for a big company.", "Мы работаем в большой компании.", None),
    ("I know what you mean.", "Я понимаю, о чём ты.", None),
    ("They want a new house.", "Они хотят новый дом.", None),
    ("I like it here.", "Мне здесь нравится.", None),
]

E12 = [
    ("He works in a bank.", "Он работает в банке.", None),
    ("He lives here.", "Он живёт здесь.", None),
    ("He knows the answer.", "Он знает ответ.", None),
    ("He wants a coffee.", "Он хочет кофе.", None),
    ("He likes music.", "Он любит музыку.", None),
    ("He needs help.", "Ему нужна помощь.", None),
    ("He speaks English.", "Он говорит по-английски.", None),
    ("She works in a school.", "Она работает в школе.", None),
    ("She lives in Paris.", "Она живёт в Париже.", None),
    ("She knows my sister.", "Она знает мою сестру.", None),
    ("She wants tea.", "Она хочет чай.", None),
    ("She likes this book.", "Ей нравится эта книга.", None),
    ("It works.", "Это работает.", None),
    ("It opens at nine.", "Он открывается в девять.", None),
    ("It closes at six.", "Он закрывается в шесть.", None),
    ("The shop opens at ten.", "Магазин открывается в десять.", None),
    ("The museum closes at five.", "Музей закрывается в пять.", None),
    ("The train leaves at eight.", "Поезд отправляется в восемь.", None),
    ("The bus stops here.", "Автобус останавливается здесь.", None),
    ("My family stays with me.", "Моя семья остаётся со мной.", None),
    ("He goes to work at seven.", "Он идёт на работу в семь.", None),
    ("She goes to school.", "Она ходит в школу.", None),
    ("He watches TV in the evening.", "Он смотрит телевизор вечером.", None),
    ("She reads books.", "Она читает книги.", None),
    ("He plays football.", "Он играет в футбол.", None),
    ("She cooks dinner.", "Она готовит ужин.", None),
    ("He drives a bus.", "Он водит автобус.", None),
    ("She teaches English.", "Она преподаёт английский.", None),
    ("It rains a lot here.", "Здесь часто идёт дождь.", None),
    ("He sleeps well.", "Он хорошо спит.", None),
    ("She sings beautifully.", "Она красиво поёт.", None),
    ("My father works every day.", "Мой отец работает каждый день.", None),
    ("My mother likes flowers.", "Моя мама любит цветы.", None),
    ("My brother studies at university.", "Мой брат учится в университете.", None),
    ("Anna speaks two languages.", "Анна говорит на двух языках.", None),
    ("Ivan lives in Kazan.", "Иван живёт в Казани.", None),
    ("On Monday I work.", "В понедельник я работаю.", None),
    ("On Tuesday she rests.", "Во вторник она отдыхает.", None),
    ("From Monday to Friday.", "С понедельника по пятницу.", None),
    ("He starts work at nine.", "Он начинает работу в девять.", None),
    ("She finishes at five.", "Она заканчивает в пять.", None),
    ("The film starts at eight.", "Фильм начинается в восемь.", None),
    ("It sounds good.", "Звучит хорошо.", None),
    ("He knows nothing.", "Он ничего не знает.", None),
]

E13 = [
    ("I don't work on Sunday.", "Я не работаю в воскресенье.", None),
    ("I don't live in Moscow.", "Я не живу в Москве.", None),
    ("I don't know.", "Я не знаю.", None),
    ("I don't want it.", "Я не хочу этого.", None),
    ("I don't like coffee.", "Я не люблю кофе.", None),
    ("I don't need money.", "Мне не нужны деньги.", None),
    ("I don't speak English well.", "Я плохо говорю по-английски.", None),
    ("I don't understand.", "Я не понимаю.", None),
    ("I don't understand you.", "Я тебя не понимаю.", None),
    ("We don't work today.", "Мы сегодня не работаем.", None),
    ("We don't live here.", "Мы не живём здесь.", None),
    ("We don't know him.", "Мы его не знаем.", None),
    ("We don't want to go.", "Мы не хотим идти.", None),
    ("We don't like this weather.", "Нам не нравится эта погода.", None),
    ("You don't understand me.", "Ты меня не понимаешь.", None),
    ("You don't know him.", "Ты его не знаешь.", None),
    ("You don't need this.", "Тебе это не нужно.", None),
    ("You don't work here.", "Ты здесь не работаешь.", None),
    ("They don't speak Russian.", "Они не говорят по-русски.", None),
    ("They don't live in Russia.", "Они не живут в России.", None),
    ("They don't know the city.", "Они не знают город.", None),
    ("They don't want money.", "Им не нужны деньги.", None),
    ("I don't have time.", "У меня нет времени.", None),
    ("I don't have a car.", "У меня нет машины.", None),
    ("I don't eat meat.", "Я не ем мясо.", None),
    ("I don't drink coffee.", "Я не пью кофе.", None),
    ("I don't watch TV.", "Я не смотрю телевизор.", None),
    ("I don't smoke.", "Я не курю.", None),
    ("We don't understand the rule.", "Мы не понимаем правило.", None),
    ("Friends don't lie.", "Друзья не лгут.", None),
    ("I don't like winter.", "Я не люблю зиму.", None),
    ("I don't want to go.", "Я не хочу идти.", None),
    ("I don't want to work today.", "Я не хочу сегодня работать.", None),
    ("I don't think so.", "Я так не думаю.", None),
    ("I don't mean it.", "Я не это имею в виду.", None),
    ("Sorry, I don't know.", "Извини, я не знаю.", None),
    ("Sorry, we don't understand.", "Извините, мы не понимаем.", None),
    ("They don't like tourists.", "Они не любят туристов.", None),
    ("I don't see it.", "Я этого не вижу.", None),
    ("I don't hear you.", "Я тебя не слышу.", None),
    ("We don't have milk.", "У нас нет молока.", None),
    ("I don't want to sleep.", "Я не хочу спать.", None),
    ("It doesn't interest me.", "Меня это не интересует.", None),
    ("I don't agree.", "Я не согласен.", None),
]

E14 = [
    ("He doesn't work here.", "Он здесь не работает.", None),
    ("He doesn't live in Moscow.", "Он не живёт в Москве.", None),
    ("He doesn't know me.", "Он меня не знает.", None),
    ("He doesn't want coffee.", "Он не хочет кофе.", None),
    ("He doesn't like tea.", "Он не любит чай.", None),
    ("She doesn't speak English.", "Она не говорит по-английски.", None),
    ("She doesn't work today.", "Она сегодня не работает.", None),
    ("She doesn't know the answer.", "Она не знает ответ.", None),
    ("She doesn't like cold weather.", "Ей не нравится холодная погода.", None),
    ("It doesn't work.", "Это не работает.", None),
    ("It doesn't matter.", "Это не важно.", None),
    ("It doesn't open on Sunday.", "Он не открывается в воскресенье.", None),
    ("The shop doesn't work today.", "Магазин сегодня не работает.", None),
    ("The bus doesn't stop here.", "Автобус здесь не останавливается.", None),
    ("The museum doesn't open on Monday.", "Музей не открывается в понедельник.", None),
    ("My father doesn't smoke.", "Мой отец не курит.", None),
    ("My mother doesn't drive.", "Моя мама не водит машину.", None),
    ("My friend doesn't eat meat.", "Мой друг не ест мясо.", None),
    ("Anna doesn't watch TV.", "Анна не смотрит телевизор.", None),
    ("Ivan doesn't like football.", "Иван не любит футбол.", None),
    ("He doesn't understand me.", "Он меня не понимает.", None),
    ("She doesn't want to go.", "Она не хочет идти.", None),
    ("He doesn't need help.", "Ему не нужна помощь.", None),
    ("She doesn't have a phone.", "У неё нет телефона.", None),
    ("He doesn't have time.", "У него нет времени.", None),
    ("It doesn't cost much.", "Это стоит немного.", None),
    ("This word doesn't exist.", "Такого слова не существует.", None),
    ("The plan doesn't work.", "План не работает.", None),
    ("He doesn't drink tea.", "Он не пьёт чай.", None),
    ("She doesn't read newspapers.", "Она не читает газеты.", None),
    ("He doesn't play tennis.", "Он не играет в теннис.", None),
    ("She doesn't cook on Sunday.", "Она не готовит в воскресенье.", None),
    ("My sister doesn't like fish.", "Моя сестра не любит рыбу.", None),
    ("My brother doesn't work.", "Мой брат не работает.", None),
    ("The baby doesn't sleep.", "Ребёнок не спит.", None),
    ("He doesn't want to talk.", "Он не хочет разговаривать.", None),
    ("She doesn't want to stay.", "Она не хочет оставаться.", None),
    ("He doesn't know the city.", "Он не знает город.", None),
    ("It doesn't sound right.", "Это звучит неправильно.", None),
    ("That doesn't make sense.", "Это не имеет смысла.", None),
    ("He doesn't mean it.", "Он не это имеет в виду.", None),
    ("She doesn't agree.", "Она не согласна.", None),
    ("It doesn't happen often.", "Это случается не часто.", None),
    ("He doesn't live here anymore.", "Он больше здесь не живёт.", None),
]

E15 = [
    ("I work, but she doesn't.", "Я работаю, а она нет.", None),
    ("He knows, but they don't.", "Он знает, а они нет.", None),
    ("I live here and he lives there.", "Я живу здесь, а он там.", None),
    ("We don't understand this rule.", "Мы не понимаем это правило.", None),
    ("Does it matter? — It doesn't matter.", "Это важно? — Это не важно.", None),
    ("My friend doesn't speak English.", "Мой друг не говорит по-английски.", None),
    ("Help! I'm lost.", "Помогите! Я потерялся.", None),
    ("I don't understand.", "Я не понимаю.", None),
    ("Please speak slowly.", "Пожалуйста, говорите медленнее.", None),
    ("Where is the police station?", "Где полицейский участок?", None),
    ("Where is the hospital?", "Где больница?", None),
    ("I need a doctor.", "Мне нужен врач.", None),
    ("Call the police!", "Вызовите полицию!", None),
    ("It is an emergency.", "Это чрезвычайная ситуация.", None),
    ("I work in a bank, and my sister works in a school.", "Я работаю в банке, а моя сестра — в школе.", None),
    ("He likes coffee, but she likes tea.", "Он любит кофе, а она чай.", None),
    ("They don't know where it is.", "Они не знают, где это.", None),
    ("We want to help you.", "Мы хотим помочь тебе.", None),
    ("The shop opens at nine and closes at six.", "Магазин открывается в девять и закрывается в шесть.", None),
    ("I don't want to stay home.", "Я не хочу сидеть дома.", None),
    ("She doesn't want to go with us.", "Она не хочет идти с нами.", None),
    ("Do you understand me now?", "Ты меня сейчас понимаешь?", None),
    ("I know this street.", "Я знаю эту улицу.", None),
    ("This bus doesn't go to the station.", "Этот автобус не идёт к вокзалу.", None),
    ("We need a map.", "Нам нужна карта.", None),
    ("He works from nine to five.", "Он работает с девяти до пяти.", None),
    ("They live near the airport.", "Они живут рядом с аэропортом.", None),
    ("I don't like this weather.", "Мне не нравится эта погода.", None),
    ("It works now!", "Теперь работает!", None),
    ("My phone doesn't work.", "Мой телефон не работает.", None),
    ("Everything works fine.", "Всё работает хорошо.", None),
    ("I want to go home.", "Я хочу домой.", None),
    ("We don't have time.", "У нас нет времени.", None),
    ("She knows the answer, but she doesn't say it.", "Она знает ответ, но не говорит его.", None),
    ("Nobody knows.", "Никто не знает.", None),
    ("Everybody wants to help.", "Все хотят помочь.", None),
    ("It rains here in autumn.", "Здесь идёт дождь осенью.", None),
    ("He doesn't believe me.", "Он мне не верит.", None),
    ("I don't remember.", "Я не помню.", None),
    ("We start at eight.", "Мы начинаем в восемь.", None),
    ("The lesson ends at six.", "Урок заканчивается в шесть.", None),
    ("I like my work.", "Мне нравится моя работа.", None),
    ("They want to learn Russian.", "Они хотят выучить русский.", None),
    ("Something doesn't work.", "Что-то не работает.", None),
]

# --------------------------------------------------------------------------
# Правила и метаданные уроков (specs/01 §5)
# --------------------------------------------------------------------------
RULE_E01 = """По-русски «я — Иван» можно сказать без глагола. По-английски — нельзя: нужен глагол-связка **to be**.

- **I am** Ivan. — Я Иван.
- **He / She / It is** from Canada. — Он из Канады.
- **You / We / They are** friends. — Мы друзья.

Сокращения: I am = I'm, he is = he's, we are = we're.

⚠️ Ловушка ЛТ-01: «I hungry» — так нельзя! Нужен am/is/are: I'm hungry."""

RULE_E02 = """После to be можно ставить прилагательное или существительное: I am **tired**. She is a **doctor**.

Перед одним исчисляемым существительным нужен артикль **a**: I am a student. He is a good doctor.

Перед гласным звуком — **an**: She is an artist. It is an old house.

⚠️ Ловушка ЛТ-06: «I have brother» — нельзя! Артикль обязателен: I have **a** brother."""

RULE_E03 = """Отрицание с to be — частица **not** после глагола:

- I am **not** a teacher. (сокращение только I'm not)
- He / She / It **is not** = **isn't** here.
- You / We / They **are not** = **aren't** ready.

Семья: mother, father, brother, sister, parents, family.

Множественное число без артикля: My parents are doctors. My friends are students."""

RULE_E04 = """Вопрос с to be: глагол выходит на первое место.

- **Are** you tired? **Are** they here?
- **Is** she your sister? **Is** it true?
- **Am** I late?

Краткие ответы — глагол, не повторяем всё: Yes, I am. / No, I'm not. Yes, it is. / No, it isn't.

Состояния: hungry, thirsty, tired, busy, cold, happy."""

RULE_E05 = """Повторение E-01…E-04 — коротко:

- **+**: I am Ivan. She is a doctor. We are friends.
- **−**: I am not tired. He isn't here. They aren't ready.
- **?**: Are you hungry? Is it true? Am I late? — Yes, I am. / No, it isn't.
- Артикль: a student, an artist, a big city.

Small talk: How are you? — I'm fine, thanks. And you?"""

LESSONS = [
    {
        "id": "les-e-01", "module": "mod-e-1",
        "title": "to be: am / is / are. Знакомство",
        "gp_id": "gp-e-01", "gp_title": "Глагол to be в настоящем времени",
        "rule_md": RULE_E01,
        "phrases": E01,
        "rule_cloze": [
            ("I ___ Ivan.", ["am"]),
            ("She ___ from Japan.", ["is"]),
            ("We ___ friends.", ["are"]),
        ],
        "quotes": [("q-star-wars-0002", "am"), ("q-star-wars-0008", "is")],
        "trap_id": "trap-no-to-be",
        "vocab_band": {"list": "ngsl-spoken", "from": 1, "to": 60},
        "phrasebook_topic": None,
        "quotes_topic": "greetings",
        "bebris_video": {"lesson": "1.26", "playlist_index": 69, "youtube_id": "bB4K-WblSIk", "title": None},
        "answer_question": [("Are you Ivan?", "I am Ivan.")],
        "find_error": [("I hungry.", "I am hungry.")],
        "verb_tense": [
            ("She ___ from Japan.", "is", ["is"]),
            ("We ___ friends.", "are", ["are"]),
            ("I ___ Ivan.", "am", ["am"]),
        ],
    },
    {
        "id": "les-e-02", "module": "mod-e-1",
        "title": "to be + прилагательное / существительное. Артикль a / an",
        "gp_id": "gp-e-02", "gp_title": "to be + свойство; артикль a/an",
        "rule_md": RULE_E02,
        "phrases": E02,
        "rule_cloze": [
            ("I am ___ student.", ["a"]),
            ("She is ___ artist.", ["an"]),
            ("It is ___ big city.", ["a"]),
        ],
        "quotes": [("q-fma-fma-b-0003", "brother"), ("q-fma-fma-b-0006", "sorry")],
        "trap_id": "trap-articles",
        "vocab_band": {"list": "ngsl-spoken", "from": 61, "to": 120},
        "phrasebook_topic": None,
        "quotes_topic": "family",
        "bebris_video": {"lesson": "1.27", "playlist_index": 71, "youtube_id": "EmmoAPtgllA", "title": None},
        "answer_question": [("Is it a big city?", "It is a big city.")],
        "find_error": [("I have brother.", "I have a brother.")],
        "verb_tense": [
            ("She is ___ artist.", "a/an", ["an", "a"]),
            ("It is ___ big city.", "a/an", ["a"]),
            ("He is ___ doctor.", "a/an", ["a"]),
        ],
    },
    {
        "id": "les-e-03", "module": "mod-e-1",
        "title": "to be: отрицание isn't / aren't",
        "gp_id": "gp-e-03", "gp_title": "Отрицание с to be",
        "rule_md": RULE_E03,
        "phrases": E03,
        "rule_cloze": [
            ("He ___ not here.", ["is"]),
            ("They ___ not ready.", ["are"]),
            ("It is ___ true.", ["not"]),
        ],
        "quotes": [("q-game-of-thrones-0006", "not"), ("q-game-of-thrones-0004", "Not")],
        "trap_id": "trap-articles",
        "vocab_band": {"list": "ngsl-spoken", "from": 121, "to": 180},
        "phrasebook_topic": None,
        "quotes_topic": "family",
        "bebris_video": {"lesson": "1.30", "playlist_index": 79, "youtube_id": "9omB2YuL1Z8", "title": None},
        "answer_question": [("Is he here?", "He is not here.")],
        "find_error": [("He not is here.", "He is not here.")],
        "verb_tense": [
            ("They ___ not ready.", "are", ["are"]),
            ("It ___ not true.", "is", ["is"]),
            ("We ___ not late.", "are", ["are"]),
        ],
    },
    {
        "id": "les-e-04", "module": "mod-e-1",
        "title": "to be: вопрос Are you…? + краткие ответы",
        "gp_id": "gp-e-04", "gp_title": "Вопрос с to be и краткие ответы",
        "rule_md": RULE_E04,
        "phrases": E04,
        "rule_cloze": [
            ("___ you busy?", ["Are"]),
            ("___ she your sister?", ["Is"]),
            ("___ I late?", ["Am"]),
        ],
        "quotes": [("q-black-mirror-0006", "Is"), ("q-fma-fma-b-0008", "Is")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 181, "to": 240},
        "phrasebook_topic": None,
        "quotes_topic": "questions",
        "bebris_video": {"lesson": "1.31", "playlist_index": 82, "youtube_id": "mRQMPhB6c_Y", "title": None},
        "answer_question": [("Are you tired?", "Yes, I am.")],
        "find_error": [("You is tired?", "Are you tired?")],
        "verb_tense": [
            ("___ you hungry?", "are", ["Are"]),
            ("___ she your sister?", "is", ["Is"]),
            ("___ I late?", "am", ["Am"]),
        ],
    },
    {
        "id": "les-e-05", "module": "mod-e-1",
        "title": "Повторение №1 (E-01…E-04) + мини-контроль",
        "gp_id": "gp-e-05", "gp_title": "Повторение: to be +, −, ?; Small talk",
        "rule_md": RULE_E05,
        "phrases": E05,
        "rule_cloze": [
            ("I ___ from Russia.", ["am"]),
            ("___ you tired?", ["Are"]),
            ("It ___ not a problem.", ["is"]),
        ],
        "quotes": [("q-star-wars-0011", "is"), ("q-black-mirror-0001", "not")],
        "trap_id": None,
        "vocab_band": None,
        "phrasebook_topic": None,
        "quotes_topic": "small-talk",
        "bebris_video": None,
        "answer_question": [("How are you?", "I am fine, thank you.")],
        "find_error": [("I not am sure.", "I am not sure.")],
        "verb_tense": [
            ("I ___ from Russia, and you?", "am", ["am"]),
            ("It ___ not far.", "is", ["is"]),
            ("___ you new here?", "are", ["Are"]),
        ],
    },
    {
        "id": "les-e-06", "module": "mod-e-1",
        "title": "to be: спецвопросы What / Where / How",
        "gp_id": "gp-e-06", "gp_title": "Спецвопросы с to be",
        "rule_md": RULE_E06,
        "phrases": E06,
        "rule_cloze": [
            ("___ is your name?", ["What"]),
            ("___ are you from?", ["Where"]),
            ("How ___ are you?", ["old"]),
        ],
        "quotes": [("q-breaking-bad-0011", "What"), ("q-breaking-bad-0012", "Why")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 241, "to": 300},
        "phrasebook_topic": None,
        "quotes_topic": "questions",
        "bebris_video": {"lesson": "1.33", "playlist_index": 88, "youtube_id": "sQ6HMW37Xh4", "title": None},
        "answer_question": [("What is your name?", "My name is Anna.")],
        "verb_tense": [
            ("___ is your name?", "what", ["What"]),
            ("___ are you from?", "where", ["Where"]),
            ("How ___ are you?", "old", ["old"]),
        ],
    },
    {
        "id": "les-e-07", "module": "mod-e-2",
        "title": "this / these / that / those",
        "gp_id": "gp-e-07", "gp_title": "Указательные местоимения",
        "rule_md": RULE_E07,
        "phrases": E07,
        "rule_cloze": [
            ("___ is my phone.", ["This"]),
            ("___ are my friends.", ["These"]),
            ("___ is your house.", ["That"]),
        ],
        "quotes": [("q-star-wars-0011", "That"), ("q-memy-0001", "This")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 301, "to": 360},
        "phrasebook_topic": None,
        "quotes_topic": "things",
        "bebris_video": {"lesson": "1.5", "playlist_index": 9, "youtube_id": "nPXmJZx60K0", "title": None},
        "answer_question": [("Is this your bag?", "This is my phone.")],
        "verb_tense": [
            ("___ are my keys.", "plural", ["These"]),
            ("___ is my house.", "singular", ["This", "That"]),
            ("___ are her shoes.", "plural-far", ["Those"]),
        ],
    },
    {
        "id": "les-e-08", "module": "mod-e-2",
        "title": "Притяжательные my/his/her + ’s",
        "gp_id": "gp-e-08", "gp_title": "Притяжательные местоимения и падеж ’s",
        "rule_md": RULE_E08,
        "phrases": E08,
        "rule_cloze": [
            ("___ name is Dima.", ["His"]),
            ("___ name is Anna.", ["Her"]),
            ("This is ___ sister. (Dima)", ["Dima's"]),
        ],
        "quotes": [("q-stranger-things-0002", "OUR"), ("q-star-wars-0012", "my")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 361, "to": 420},
        "phrasebook_topic": None,
        "quotes_topic": "family",
        "bebris_video": None,
        "answer_question": [("How old is your sister?", "My brother is ten years old.")],
        "verb_tense": [
            ("___ car is new. (he)", "possessive", ["His"]),
            ("___ phone is old. (she)", "possessive", ["Her"]),
            ("This is ___ book. (Anna)", "possessive-case", ["Anna's"]),
        ],
    },
    {
        "id": "les-e-09", "module": "mod-e-2",
        "title": "Множественное число и числа 20–100",
        "gp_id": "gp-e-09", "gp_title": "Множественное число существительных",
        "rule_md": RULE_E09,
        "phrases": E09,
        "rule_cloze": [
            ("The ___ are happy.", ["children"]),
            ("These are my ___.", ["books"]),
            ("The ___ are here.", ["men"]),
        ],
        "quotes": [("q-memy-0005", "pigeon"), ("q-memy-0001", "fine")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 421, "to": 480},
        "phrasebook_topic": None,
        "quotes_topic": "numbers",
        "bebris_video": None,
        "answer_question": [("How many books do you have?", "I have two apples.")],
        "verb_tense": [
            ("The ___ are at school.", "plural-special", ["children"]),
            ("These ___ are red.", "plural", ["apples"]),
            ("My ___ are cold.", "plural-special", ["feet"]),
        ],
    },
    {
        "id": "les-e-10", "module": "mod-e-2",
        "title": "Повторение №2 (E-06…E-09) + диктант-микс",
        "gp_id": "gp-e-10", "gp_title": "Повторение: wh-вопросы, указательные, притяжательные, множественное",
        "rule_md": RULE_E10,
        "phrases": E10,
        "rule_cloze": [
            ("___ is your name?", ["What"]),
            ("___ are my friends.", ["These"]),
            ("The ___ are here.", ["men"]),
        ],
        "quotes": [("q-stranger-things-0010", "What"), ("q-breaking-bad-0013", "How")],
        "trap_id": None,
        "vocab_band": None,
        "phrasebook_topic": None,
        "quotes_topic": "small-talk",
        "bebris_video": None,
        "answer_question": [("Where are you from?", "I am from Russia.")],
        "verb_tense": [
            ("___ are you from?", "where", ["Where"]),
            ("___ is my phone.", "singular-near", ["This"]),
            ("___ name is Anna.", "possessive", ["Her", "His"]),
        ],
    },

    {
        "id": "les-e-11", "module": "mod-e-3",
        "title": "Present Simple: (+) I / we / you / they",
        "gp_id": "gp-e-11", "gp_title": "Present Simple — утверждение",
        "rule_md": RULE_E11,
        "phrases": E11,
        "rule_cloze": [
            ("I ___ in an office.", ["work"]),
            ("We ___ in Russia.", ["live"]),
            ("They ___ English.", ["speak"]),
        ],
        "quotes": [("q-game-of-thrones-0002", "know"), ("q-supernatural-0008", "know")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 481, "to": 540},
        "phrasebook_topic": None,
        "quotes_topic": "work",
        "bebris_video": {"lesson": "1.1", "playlist_index": 1, "youtube_id": "Hp9wUEDasY4", "title": None},
        "answer_question": [("Where do you live?", "I live in Moscow.")],
        "verb_tense": [
            ("I ___ in an office.", "present-simple", ["work"]),
            ("They ___ in London.", "present-simple", ["live"]),
            ("We ___ tea.", "present-simple", ["like"]),
        ],
    },
    {
        "id": "les-e-12", "module": "mod-e-3",
        "title": "Present Simple: he/she/it + -s",
        "gp_id": "gp-e-12", "gp_title": "Present Simple — третье лицо (-s)",
        "rule_md": RULE_E12,
        "phrases": E12,
        "rule_cloze": [
            ("He ___ in a bank.", ["works"]),
            ("She ___ in Paris.", ["lives"]),
            ("It ___ at nine.", ["opens"]),
        ],
        "quotes": [("q-game-of-thrones-0007", "stays"), ("q-the-100-0007", "fights")],
        "trap_id": "trap-third-person-s",
        "vocab_band": {"list": "ngsl-spoken", "from": 541, "to": 600},
        "phrasebook_topic": None,
        "quotes_topic": "work",
        "bebris_video": {"lesson": "1.2", "playlist_index": 3, "youtube_id": "nXI9CN5a6ew", "title": None},
        "answer_question": [("Where does he work?", "He works in a bank.")],
        "find_error": [("He live here.", "He lives here.")],
        "verb_tense": [
            ("He ___ in a bank.", "3rd-person", ["works"]),
            ("She ___ to school.", "3rd-person", ["goes"]),
            ("It ___ at nine.", "3rd-person", ["opens"]),
        ],
    },
    {
        "id": "les-e-13", "module": "mod-e-3",
        "title": "Present Simple: отрицание don't",
        "gp_id": "gp-e-13", "gp_title": "Present Simple — отрицание (don't)",
        "rule_md": RULE_E13,
        "phrases": E13,
        "rule_cloze": [
            ("I ___ know.", ["don't"]),
            ("We ___ understand.", ["don't"]),
            ("They ___ live in Russia.", ["don't"]),
        ],
        "quotes": [("q-stranger-things-0001", "don't"), ("q-supernatural-0003", "don't")],
        "trap_id": "trap-no-do-negative",
        "vocab_band": {"list": "ngsl-spoken", "from": 601, "to": 660},
        "phrasebook_topic": None,
        "quotes_topic": "negation",
        "bebris_video": {"lesson": "1.8", "playlist_index": 17, "youtube_id": "8O2JICbDthQ", "title": None},
        "answer_question": [("Do you understand me?", "I don't understand.")],
        "find_error": [("I no speak English.", "I don't speak English well.")],
        "verb_tense": [
            ("I ___ work on Sunday.", "negative", ["don't", "do not"]),
            ("We ___ know him.", "negative", ["don't", "do not"]),
            ("They ___ want money.", "negative", ["don't", "do not"]),
        ],
    },
    {
        "id": "les-e-14", "module": "mod-e-3",
        "title": "Present Simple: doesn't (глагол без -s)",
        "gp_id": "gp-e-14", "gp_title": "Present Simple — отрицание 3-го лица",
        "rule_md": RULE_E14,
        "phrases": E14,
        "rule_cloze": [
            ("He ___ work here.", ["doesn't"]),
            ("She ___ speak English.", ["doesn't"]),
            ("It ___ work.", ["doesn't"]),
        ],
        "quotes": [("q-black-mirror-0005", "doesn't"), ("q-stranger-things-0005", "don't")],
        "trap_id": "trap-third-person-s",
        "vocab_band": {"list": "ngsl-spoken", "from": 661, "to": 719},
        "phrasebook_topic": None,
        "quotes_topic": "negation",
        "bebris_video": {"lesson": "1.9", "playlist_index": 19, "youtube_id": "82Z289SJSYA", "title": None},
        "answer_question": [("Does he work here?", "He doesn't work here.")],
        "find_error": [("It not matter.", "It doesn't matter."), ("He doesn't works.", "He doesn't work here.")],
        "verb_tense": [
            ("He ___ work here.", "3rd-negative", ["doesn't", "does not"]),
            ("She ___ like tea.", "3rd-negative", ["doesn't", "does not"]),
            ("It ___ work.", "3rd-negative", ["doesn't", "does not"]),
        ],
    },
    {
        "id": "les-e-15", "module": "mod-e-3",
        "title": "Повторение №3 + контрольная-тренировка",
        "gp_id": "gp-e-15", "gp_title": "Повторение: Present Simple +/−, Экстренные-I",
        "rule_md": RULE_E15,
        "phrases": E15,
        "rule_cloze": [
            ("I ___, but she doesn't.", ["work"]),
            ("He ___ in a bank.", ["works"]),
            ("I ___ understand.", ["don't"]),
        ],
        "quotes": [("q-black-mirror-0003", "don't"), ("q-supernatural-0005", "want")],
        "trap_id": None,
        "vocab_band": None,
        "phrasebook_topic": None,
        "quotes_topic": "emergency",
        "bebris_video": None,
        "answer_question": [("Do you want to go home?", "I want to go home.")],
        "find_error": [("She don't like fish.", "My sister doesn't like fish."), ("He work every day.", "My father works every day.")],
        "verb_tense": [
            ("He ___ from nine to five.", "3rd-person", ["works"]),
            ("We ___ have time.", "negative", ["don't", "do not"]),
            ("She ___ the answer.", "3rd-person", ["knows"]),
        ],
    },
]

# Выбор фраз для производных шагов (индексы внутри пула урока)
WB_COUNT, TR_COUNT, SP_EVERY = 8, 16, 4  # построение: 8 word-bank + 16 перевод + speak каждая 4-я
DICT_COUNT, SHADOW_COUNT = 5, 4
WARMUP_CHOOSE = 4
MATCH_PAIRS = 5

rng = random.Random(SEED)


def load_quote(quote_id: str) -> dict:
    for fp in sorted((DATA / "quotes").glob("*.json")):
        for item in json.loads(fp.read_text(encoding="utf-8"))["items"]:
            if item["id"] == quote_id:
                return item
    raise SystemExit(f"цитата {quote_id} не найдена")


def build():
    phrases_out, exercises_out, lessons_out = [], [], []
    audio_rows = []
    ph_n = 0
    ex_n = 0

    def next_ex() -> str:
        nonlocal ex_n
        ex_n += 1
        return f"ex-e-{ex_n:04d}"

    for spec in LESSONS:
        lesson_phrase_ids = []
        lesson_phrase_items = []
        for en, ru, variants in spec["phrases"]:
            ph_n += 1
            pid = f"ph-e-{ph_n:04d}"
            lesson_phrase_ids.append(pid)
            item = {
                "id": pid,
                "text_en": en,
                "translation_ru": ru,
                "grammar_point_id": spec["gp_id"],
                "variants": variants if variants else [en],
                "audio": {"en_gb": f"audio/phrases/cori/{pid}.opus"},
            }
            phrases_out.append(item)
            lesson_phrase_items.append(item)
            audio_rows.append((pid, en))

        def phrase_by_text(text: str):
            # find_error/answer_question могут ссылаться на фразы любых уроков (схема §3)
            for item in lesson_phrase_items:
                if item["text_en"] == text:
                    return item
            for item in phrases_out:
                if item["text_en"] == text:
                    return item
            raise SystemExit(f"фраза {text!r} не найдена в пулах")

        lesson_exercises = []

        # --- Шаг 1: правило — cloze на понимание -----------------------------
        for text, answers in spec["rule_cloze"]:
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "cloze",
                "payload": {"kind": "cloze", "text_with_gap": text, "gap_answers": answers},
                "answer": {"normalization": "default", "typo": "exact"},
                "meta": {"skill": "grammar", "xp": 2},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 2: разогрев — choose_translation + match_pairs --------------
        short = [p for p in lesson_phrase_items if 1 <= len(p["text_en"].split()) <= 4]
        rng.shuffle(short)
        for target in short[:WARMUP_CHOOSE]:
            pool = [
                p["text_en"]
                for p in short
                if p is not target and p["translation_ru"] != target["translation_ru"]
            ][:3]
            options = pool + [target["text_en"]]
            rng.shuffle(options)
            correct = options.index(target["text_en"])
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "choose_translation",
                "payload": {"kind": "choose_translation", "prompt": target["translation_ru"],
                            "options": options, "correct": correct},
                "answer": {"normalization": "default", "typo": "exact"},
                "meta": {"skill": "words", "xp": 1},
            })
            lesson_exercises.append({"id": eid})
        seen_ru = set()
        pair_pool = [p for p in short if not (p["translation_ru"] in seen_ru or seen_ru.add(p["translation_ru"]))]
        pairs = pair_pool[WARMUP_CHOOSE:WARMUP_CHOOSE + MATCH_PAIRS]
        if len(pairs) < MATCH_PAIRS:
            pairs = pair_pool[:MATCH_PAIRS]
        eid = next_ex()
        exercises_out.append({
            "id": eid, "type": "match_pairs",
            "payload": {"kind": "match_pairs",
                        "pairs": [{"en": p["text_en"], "ru": p["translation_ru"]} for p in pairs]},
            "answer": {"normalization": "default", "typo": "exact"},
            "meta": {"skill": "words", "xp": 1},
        })
        lesson_exercises.append({"id": eid})

        # --- Шаг 3: построение — word_bank → translate, speak каждая 4-я -----
        build_pool = [p for p in lesson_phrase_items
                      if p["text_en"] not in {q for q, _ in spec["quotes"]}]
        rng.shuffle(build_pool)
        build_pool = build_pool[: WB_COUNT + TR_COUNT]
        for i, target in enumerate(build_pool):
            eid = next_ex()
            if i < WB_COUNT:
                tokens = target["text_en"].replace("!", "").replace("?", "").replace(".", "")
                tokens = [t for t in tokens.split() if t]
                distractors = []
                for other in build_pool:
                    if other is target or len(distractors) >= 2:
                        continue
                    for w in other["text_en"].split():
                        if w not in tokens and w.isalpha() and len(w) > 2 and w not in distractors:
                            distractors.append(w)
                            break
                all_tokens = tokens + distractors
                rng.shuffle(all_tokens)
                exercises_out.append({
                    "id": eid, "type": "word_bank",
                    "payload": {"kind": "word_bank", "prompt_ru": target["translation_ru"],
                                "phrase_id": target["id"], "tokens": all_tokens},
                    "answer": {"normalization": "default", "typo": "allow"},
                    "meta": {"skill": "grammar", "xp": 2},
                })
            elif (i - WB_COUNT) % SP_EVERY == SP_EVERY - 1:
                exercises_out.append({
                    "id": eid, "type": "speak",
                    "payload": {"kind": "speak", "prompt_ru": target["translation_ru"],
                                "phrase_id": target["id"]},
                    "answer": {"normalization": "default", "typo": "allow", "speech_threshold": 0.85},
                    "meta": {"skill": "speaking", "xp": 4},
                })
            else:
                exercises_out.append({
                    "id": eid, "type": "translate",
                    "payload": {"kind": "translate", "prompt_ru": target["translation_ru"],
                                "phrase_id": target["id"]},
                    "answer": {"normalization": "default", "typo": "allow"},
                    "meta": {"skill": "grammar", "xp": 2},
                })
            lesson_exercises.append({"id": eid})

        # --- Построение+: время глагола; найди ошибку — отложенным проходом ----
        for sentence, marker, answers in spec.get("verb_tense", []):
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "verb_tense",
                "payload": {"kind": "verb_tense", "sentence_with_gap": sentence,
                            "marker": marker, "gap_answers": answers},
                "answer": {"normalization": "default", "typo": "exact"},
                "meta": {"skill": "grammar", "xp": 3},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 4: слух — диктант -------------------------------------------
        dict_pool = sorted(lesson_phrase_items, key=lambda p: len(p["text_en"].split()))
        dict_pool = [p for p in dict_pool if 3 <= len(p["text_en"].split()) <= 6][: DICT_COUNT * 2]
        rng.shuffle(dict_pool)
        for target in dict_pool[:DICT_COUNT]:
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "dictation",
                "payload": {"kind": "dictation", "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow"},
                "meta": {"skill": "listening", "xp": 3},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 5: речь — shadowing + answer_question ------------------------
        shadow_pool = [p for p in lesson_phrase_items if 2 <= len(p["text_en"].split()) <= 5]
        rng.shuffle(shadow_pool)
        for target in shadow_pool[:SHADOW_COUNT]:
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "shadowing",
                "payload": {"kind": "shadowing", "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow", "speech_threshold": 0.85},
                "meta": {"skill": "speaking", "xp": 3},
            })
            lesson_exercises.append({"id": eid})
        for question_en, answer_text in spec.get("answer_question", []):
            target = phrase_by_text(answer_text)
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "answer_question",
                "payload": {"kind": "answer_question", "question_en": question_en,
                            "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow", "speech_threshold": 0.85},
                "meta": {"skill": "speaking", "xp": 4},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 6: из сериала — cloze в цитатах ------------------------------
        for quote_id, gap_word in spec["quotes"]:
            q = load_quote(quote_id)
            text = q["text"]
            gap_re = re.compile(rf"\b{re.escape(gap_word)}\b")
            if not gap_re.search(text):
                raise SystemExit(f"слово {gap_word!r} не найдено в цитате {quote_id}: {text!r}")
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "cloze",
                "payload": {
                    "kind": "cloze",
                    "text_with_gap": gap_re.sub("___", text, count=1),
                    "gap_answers": [gap_word],
                    "quote": {"title": q["title"], "season_episode": q["season_episode"]},
                },
                "answer": {"normalization": "default", "typo": "exact",
                           "hint_ru": "Вспомни цитату из урока"},
                "meta": {"skill": "grammar", "xp": 2},
            })
            lesson_exercises.append({"id": eid})

        lessons_out.append({
            "id": spec["id"],
            "rank": "E",
            "module": spec["module"],
            "title": spec["title"],
            "grammar_point": {
                "id": spec["gp_id"],
                "title_ru": spec["gp_title"],
                "rule_md": spec["rule_md"],
                "phrase_ids": lesson_phrase_ids[:5],
                "trap_id": spec["trap_id"],
            },
            "vocab_band": spec["vocab_band"],
            "phrasebook_topic": spec["phrasebook_topic"],
            "trap_id": spec["trap_id"],
            "quotes_topic": spec["quotes_topic"],
            "exercises": lesson_exercises,
            "bebris_video": spec["bebris_video"],
        })

    # find_error ссылается на фразы любых уроков — генерируем после всех пулов
    for li, spec in enumerate(LESSONS):
        for wrong, right in spec.get("find_error", []):
            target = next((item for item in phrases_out if item["text_en"] == right), None)
            if target is None:
                raise SystemExit(f"фраза {right!r} не найдена в пулах (find_error {spec['id']})")
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "find_error",
                "payload": {"kind": "find_error", "wrong_en": wrong,
                            "hint_ru": target["translation_ru"],
                            "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow",
                           "accepted": [right]},
                "meta": {"skill": "grammar", "xp": 3},
            })
            lessons_out[li]["exercises"].append({"id": eid})

    (DATA / "phrases").mkdir(exist_ok=True)
    (DATA / "phrases" / "phrases-e.json").write_text(
        json.dumps({"schema_version": 1, "kind": "phrases", "items": phrases_out},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DATA / "lessons").mkdir(exist_ok=True)
    (DATA / "lessons" / "exercises-e.json").write_text(
        json.dumps({"schema_version": 1, "kind": "exercises", "items": exercises_out},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DATA / "lessons" / "lessons-e.json").write_text(
        json.dumps({"schema_version": 1, "kind": "lessons", "items": lessons_out},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    raw = DATA / "raw"
    raw.mkdir(exist_ok=True)
    (raw / "phrase_audio_e1.tsv").write_text(
        "".join(f"{pid}\t{text}\n" for pid, text in audio_rows), encoding="utf-8")

    per_lesson = {spec["id"]: len(spec["phrases"]) for spec in LESSONS}
    print(f"фраз: {len(phrases_out)} {per_lesson}")
    print(f"упражнений: {len(exercises_out)}; уроков: {len(lessons_out)}")
    print(f"аудио-список: {raw / 'phrase_audio_e1.tsv'}")


if __name__ == "__main__":
    build()
