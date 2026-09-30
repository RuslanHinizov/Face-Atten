# -*- coding: UTF-8 -*-
"""
Редактирование имён в database.pkl

Использование:
    python edit_database.py database.pkl --list              # показать все имена
    python edit_database.py database.pkl --edit 418_1 "Иванов Иван"  # изменить имя
    python edit_database.py database.pkl --export names.csv  # экспорт в CSV
    python edit_database.py database.pkl --import names.csv  # импорт из CSV
"""
import argparse
import torch
import csv
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Редактирование имён в database.pkl')
    parser.add_argument('database', type=str, help='Путь к database.pkl')
    parser.add_argument('--list', '-l', action='store_true', help='Показать все имена')
    parser.add_argument('--edit', '-e', nargs=2, metavar=('ID', 'NAME'), help='Изменить имя: --edit 418_1 "Новое Имя"')
    parser.add_argument('--export', type=str, metavar='CSV', help='Экспорт имён в CSV')
    parser.add_argument('--import', dest='import_csv', type=str, metavar='CSV', help='Импорт имён из CSV')

    args = parser.parse_args()

    db_path = Path(args.database)
    if not db_path.exists():
        print(f"Ошибка: {db_path} не найден")
        return

    # Загрузка базы
    data = torch.load(db_path, map_location='cpu', weights_only=False)
    names = data.get('names', {})
    id_list = data.get('id_list', [])

    if args.list:
        print(f"\nИмена в {db_path}:")
        print("-" * 50)
        if id_list:
            for str_id in id_list:
                name = names.get(str_id, str_id)
                print(f"  {str_id}: {name}")
        else:
            for sid, name in sorted(names.items(), key=lambda x: int(x[0]) if x[0].isdigit() else x[0]):
                print(f"  {sid}: {name}")
        print("-" * 50)
        print(f"Всего: {len(names)} записей")

    elif args.edit:
        student_id, new_name = args.edit
        if student_id in names:
            old_name = names[student_id]
            names[student_id] = new_name
            data['names'] = names
            torch.save(data, db_path)
            print(f"Изменено: {student_id}")
            print(f"  Было: {old_name}")
            print(f"  Стало: {new_name}")
        else:
            print(f"ID '{student_id}' не найден в базе")
            print(f"Доступные ID: {list(names.keys())[:10]}...")

    elif args.export:
        csv_path = Path(args.export)
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'name'])
            if id_list:
                for str_id in id_list:
                    name = names.get(str_id, str_id)
                    writer.writerow([str_id, name])
            else:
                for sid, name in sorted(names.items(), key=lambda x: int(x[0]) if x[0].isdigit() else x[0]):
                    writer.writerow([sid, name])
        print(f"Экспортировано в {csv_path}")

    elif args.import_csv:
        csv_path = Path(args.import_csv)
        if not csv_path.exists():
            print(f"Ошибка: {csv_path} не найден")
            return

        updated = 0
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sid = str(row.get('id', ''))
                name = row.get('name', '').strip()
                if sid and name:
                    names[sid] = name
                    updated += 1

        data['names'] = names
        torch.save(data, db_path)
        print(f"Импортировано {updated} имён из {csv_path}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
