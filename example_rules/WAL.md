# WAL — The Weakest Link

## Current Phase
M4: Система паков — В ПРОЦЕССЕ

## Completed
- M1 полностью: Rails 8 init, PostgreSQL, Bootstrap 5, RSpec (+factory_bot, shoulda-matchers, faker, simplecov), Rubocop (+rspec, расширенный конфиг), Bullet, Brakeman, i18n (ru/en), базовый layout, Docker, CI/CD, Dependabot
- M2 полностью: Rails 8 authentication generator, User (username авто-генерация, email, password_digest), регистрация (email+пароль), логин/логаут, сброс пароля, страница профиля (username, email, аватар), Active Storage + active_storage-postgresql, Bootstrap-вьюхи, i18n, seed (a@a.a / 123123), 34 спеки
- M3 полностью: 8 моделей (Pack, Character, Sound, Game, Player, Round, Question, Answer), миграции, валидации, связи, enum'ы, фабрики (FactoryBot), i18n (ru/en), сиды через FactoryBot, 88 спек
- M4 частично: структура packs/warcraft3/ (103 персонажа, 846 звуков, BLP→PNG иконки, конвенция папок вместо config.json)

## TODO
- M4: rake-задача/сервис импорта пака из config.json в БД
- M4: PacksController (GET /packs, GET /packs/:slug), вьюхи
- M4: Анонимный endpoint для звуков (GET /game/sound?token=:token)
- M4: Тесты

## Known Issues
- gh CLI не имеет scope `workflow` — нельзя мержить PR через CLI если затронуты workflow-файлы

## Decisions Made
- Аватарки хранятся в PostgreSQL через active_storage-postgresql (не файловая система) — удобно для Docker
- Username не обязателен при регистрации — генерируется автоматически (Player_XXXXXX), меняется в профиле
- SimpleCov для покрытия тестами (локально, без Codecov/Coveralls)
- Сиды через обычный ActiveRecord (find_or_create_by!), идемпотентны
- Все тестовые гемы в единой группе :development, :test
- Game.created_by → belongs_to :creator (User) — хост игры, отдельно от has_many :users through :players
- Паки: конвенция папок (packs/{slug}/sounds/{char}/, icons/{char}.png) вместо config.json — rake-задача сканирует структуру

## Session Context
Start: M4 — продолжение (импорт в БД, контроллеры, тесты)
Done this session: структура packs/warcraft3/, импорт 103 юнитов (846 звуков), BLP→PNG конвертация, placeholder-иконки для 36 юнитов без .blp, отказ от config.json в пользу конвенции папок
Key files: AGENTS.md (правила, архитектура), PLANS.md (роадмап)
Watch out:
- Все тексты только через i18n (ru.yml + en.yml), никаких хардкод-строк
- Перед каждым коммитом: rubocop, brakeman, bundler-audit, rspec + обновить WAL и PLANS
- .md файлы в корне — не затирать
