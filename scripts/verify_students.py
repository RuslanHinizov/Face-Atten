# -*- coding: UTF-8 -*-
"""
Интерактивная проверка и редактирование извлечённых студентов.

Функции:
- Просмотр сетки всех студентов
- Клик на студента - показать все его фото
- Переименование студентов
- Удаление неправильных детекций
- Объединение дубликатов

Использование:
    python verify_students.py              # последний exp
    python verify_students.py --exp exp22  # конкретный exp
    python verify_students.py --list       # показать все exp
"""
import cv2
import csv
import shutil
import numpy as np
from pathlib import Path
import argparse


class StudentVerifier:
    def __init__(self, exp_dir):
        self.exp_dir = Path(exp_dir)
        self.students = []
        self.names = {}  # id -> name
        self.selected_idx = None
        self.cols = 10
        self.cell_size = 120
        self.scroll_offset = 0
        self.max_visible_rows = 5

        self.load_students()
        self.load_names()

    def load_students(self):
        """Загружает всех студентов."""
        self.students = []

        for student_dir in sorted(self.exp_dir.iterdir(),
                                   key=lambda x: int(x.name) if x.name.isdigit() else 999):
            if not student_dir.is_dir() or not student_dir.name.isdigit():
                continue

            student_id = int(student_dir.name)
            photos = sorted(list(student_dir.glob("*.png")) + list(student_dir.glob("*.jpg")))

            if photos:
                img = cv2.imread(str(photos[0]))
                if img is not None:
                    self.students.append({
                        'id': student_id,
                        'image': img,
                        'photos': photos,
                        'count': len(photos),
                        'path': student_dir
                    })

    def load_names(self):
        """Загружает имена из CSV."""
        csv_path = self.exp_dir / "students.csv"
        if csv_path.exists():
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('name'):
                        self.names[int(row['id'])] = row['name']

    def save_names(self):
        """Сохраняет имена в CSV."""
        csv_path = self.exp_dir / "students.csv"

        rows = []
        for s in self.students:
            rows.append({
                'id': s['id'],
                'photos': s['count'],
                'tracks': 1,
                'name': self.names.get(s['id'], '')
            })

        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'photos', 'tracks', 'name'])
            writer.writeheader()
            writer.writerows(rows)

        print(f"Saved: {csv_path}")

    def create_grid(self):
        """Создаёт сетку лиц."""
        if not self.students:
            return np.zeros((400, 800, 3), dtype=np.uint8)

        visible_rows = self.max_visible_rows
        total_rows = (len(self.students) + self.cols - 1) // self.cols

        grid_h = visible_rows * self.cell_size
        grid_w = self.cols * self.cell_size
        grid = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)

        start_idx = self.scroll_offset * self.cols
        end_idx = min(start_idx + visible_rows * self.cols, len(self.students))

        for idx in range(start_idx, end_idx):
            local_idx = idx - start_idx
            row = local_idx // self.cols
            col = local_idx % self.cols

            s = self.students[idx]
            img = s['image']

            # Resize
            h, w = img.shape[:2]
            scale = min(self.cell_size / w, self.cell_size / h) * 0.8
            new_w, new_h = int(w * scale), int(h * scale)
            resized = cv2.resize(img, (new_w, new_h))

            # Позиция
            y_off = row * self.cell_size + (self.cell_size - new_h) // 2
            x_off = col * self.cell_size + (self.cell_size - new_w) // 2

            # Рамка для выбранного
            if idx == self.selected_idx:
                cv2.rectangle(grid,
                             (col * self.cell_size + 2, row * self.cell_size + 2),
                             ((col + 1) * self.cell_size - 2, (row + 1) * self.cell_size - 2),
                             (0, 255, 255), 3)

            grid[y_off:y_off + new_h, x_off:x_off + new_w] = resized

            # ID и имя
            name = self.names.get(s['id'], '')
            if name:
                label = f"{s['id']}:{name[:8]}"
                color = (0, 255, 0)
            else:
                label = f"{s['id']}({s['count']})"
                color = (200, 200, 200)

            cv2.putText(grid, label, (col * self.cell_size + 3, row * self.cell_size + 14),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # Скроллбар
        if total_rows > visible_rows:
            bar_h = int(grid_h * visible_rows / total_rows)
            bar_y = int(grid_h * self.scroll_offset / total_rows)
            cv2.rectangle(grid, (grid_w - 8, bar_y), (grid_w - 2, bar_y + bar_h), (100, 100, 100), -1)

        # Инфо внизу
        info = f"Students: {len(self.students)} | Named: {len(self.names)} | Scroll: {self.scroll_offset + 1}/{total_rows}"
        cv2.rectangle(grid, (0, grid_h - 25), (grid_w, grid_h), (40, 40, 40), -1)
        cv2.putText(grid, info, (10, grid_h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        return grid

    def show_student_photos(self, student):
        """Показывает все фото студента."""
        photos = student['photos']
        if not photos:
            return

        # Создаём сетку фото
        n = len(photos)
        cols = min(5, n)
        rows = (n + cols - 1) // cols
        cell = 150

        grid = np.zeros((rows * cell, cols * cell, 3), dtype=np.uint8)

        for i, photo_path in enumerate(photos):
            img = cv2.imread(str(photo_path))
            if img is None:
                continue

            r, c = i // cols, i % cols

            h, w = img.shape[:2]
            scale = min(cell / w, cell / h) * 0.9
            new_w, new_h = int(w * scale), int(h * scale)
            resized = cv2.resize(img, (new_w, new_h))

            y_off = r * cell + (cell - new_h) // 2
            x_off = c * cell + (cell - new_w) // 2
            grid[y_off:y_off + new_h, x_off:x_off + new_w] = resized

            # Номер фото
            cv2.putText(grid, f"#{i+1}", (c * cell + 5, r * cell + 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        name = self.names.get(student['id'], f"ID {student['id']}")
        window_name = f"Student {student['id']}: {name} ({n} photos)"

        cv2.imshow(window_name, grid)
        cv2.waitKey(0)
        cv2.destroyWindow(window_name)

    def get_student_at_pos(self, x, y):
        """Возвращает индекс студента по координатам клика."""
        col = x // self.cell_size
        row = y // self.cell_size

        if col >= self.cols:
            return None

        idx = (self.scroll_offset + row) * self.cols + col
        if 0 <= idx < len(self.students):
            return idx
        return None

    def rename_student(self, idx):
        """Переименовывает студента."""
        if idx is None or idx >= len(self.students):
            return

        student = self.students[idx]
        current_name = self.names.get(student['id'], '')

        print(f"\nStudent {student['id']} (current: '{current_name}')")
        new_name = input("Enter name (empty to cancel): ").strip()

        if new_name:
            self.names[student['id']] = new_name
            self.save_names()
            print(f"Renamed to: {new_name}")
        else:
            print("Cancelled")

    def delete_student(self, idx):
        """Удаляет студента."""
        if idx is None or idx >= len(self.students):
            return

        student = self.students[idx]

        print(f"\nDelete student {student['id']}? ({student['count']} photos)")
        confirm = input("Type 'yes' to confirm: ").strip().lower()

        if confirm == 'yes':
            shutil.rmtree(student['path'])
            if student['id'] in self.names:
                del self.names[student['id']]
            self.students.pop(idx)
            self.save_names()

            if self.selected_idx is not None and self.selected_idx >= len(self.students):
                self.selected_idx = len(self.students) - 1 if self.students else None

            print(f"Deleted student {student['id']}")
        else:
            print("Cancelled")

    def merge_students(self, idx1, idx2):
        """Объединяет двух студентов."""
        if idx1 is None or idx2 is None:
            return
        if idx1 >= len(self.students) or idx2 >= len(self.students):
            return
        if idx1 == idx2:
            print("Cannot merge student with itself")
            return

        s1 = self.students[idx1]
        s2 = self.students[idx2]

        print(f"\nMerge student {s2['id']} into {s1['id']}?")
        confirm = input("Type 'yes' to confirm: ").strip().lower()

        if confirm == 'yes':
            # Перемещаем фото из s2 в s1
            start_num = s1['count'] + 1
            for i, photo in enumerate(s2['photos']):
                new_name = f"{start_num + i:03d}.jpg"
                new_path = s1['path'] / new_name
                shutil.move(str(photo), str(new_path))

            # Удаляем пустую папку
            shutil.rmtree(s2['path'])

            # Удаляем из names
            if s2['id'] in self.names:
                del self.names[s2['id']]

            # Обновляем список
            self.load_students()
            self.save_names()

            print(f"Merged {s2['id']} into {s1['id']}")
            self.selected_idx = None
        else:
            print("Cancelled")

    def run(self):
        """Запускает интерактивный просмотр."""
        window_name = "Student Verifier"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        merge_first = None  # Для режима объединения

        print("\n" + "="*50)
        print("CONTROLS:")
        print("="*50)
        print("  Click      - select student")
        print("  Double-click / Enter - view all photos")
        print("  R          - rename selected")
        print("  D          - delete selected")
        print("  M          - merge mode (click two students)")
        print("  Arrow Up/Down - scroll")
        print("  S          - save grid image")
        print("  Q / ESC    - quit")
        print("="*50 + "\n")

        def on_mouse(event, x, y, flags, param):
            nonlocal merge_first

            if event == cv2.EVENT_LBUTTONDOWN:
                idx = self.get_student_at_pos(x, y)
                if idx is not None:
                    if merge_first is not None:
                        # Завершаем объединение
                        self.merge_students(merge_first, idx)
                        merge_first = None
                    else:
                        self.selected_idx = idx
                        print(f"Selected: Student {self.students[idx]['id']}")

            elif event == cv2.EVENT_LBUTTONDBLCLK:
                idx = self.get_student_at_pos(x, y)
                if idx is not None:
                    self.show_student_photos(self.students[idx])

        cv2.setMouseCallback(window_name, on_mouse)

        while True:
            grid = self.create_grid()

            # Показываем режим объединения
            if merge_first is not None:
                cv2.putText(grid, f"MERGE MODE: Select second student (first: {self.students[merge_first]['id']})",
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

            cv2.imshow(window_name, grid)

            key = cv2.waitKey(100) & 0xFF

            if key == ord('q') or key == 27:
                break

            elif key == ord('r') and self.selected_idx is not None:
                self.rename_student(self.selected_idx)

            elif key == ord('d') and self.selected_idx is not None:
                self.delete_student(self.selected_idx)

            elif key == ord('m'):
                if self.selected_idx is not None:
                    if merge_first is None:
                        merge_first = self.selected_idx
                        print(f"Merge mode: Select second student to merge into {self.students[merge_first]['id']}")
                    else:
                        self.merge_students(merge_first, self.selected_idx)
                        merge_first = None
                else:
                    print("Select a student first (click on face)")

            elif key == 13 and self.selected_idx is not None:  # Enter
                self.show_student_photos(self.students[self.selected_idx])

            elif key == ord('s'):
                save_path = self.exp_dir / "students_grid.jpg"
                full_grid = self.create_full_grid()
                cv2.imwrite(str(save_path), full_grid)
                print(f"Saved: {save_path}")

            # Scroll
            elif key == 82 or key == ord('w'):  # Up
                if self.scroll_offset > 0:
                    self.scroll_offset -= 1
            elif key == 84 or key == ord('s'):  # Down (but not 's' for save)
                total_rows = (len(self.students) + self.cols - 1) // self.cols
                if self.scroll_offset < total_rows - self.max_visible_rows:
                    self.scroll_offset += 1

        cv2.destroyAllWindows()

        # Статистика
        print(f"\n{'='*50}")
        print("STATISTICS")
        print(f"{'='*50}")
        print(f"Total students: {len(self.students)}")
        print(f"Named: {len(self.names)}")
        print(f"Unnamed: {len(self.students) - len(self.names)}")

        single = sum(1 for s in self.students if s['count'] == 1)
        if single > 0:
            print(f"With only 1 photo: {single}")

    def create_full_grid(self):
        """Создаёт полную сетку всех студентов."""
        if not self.students:
            return np.zeros((100, 100, 3), dtype=np.uint8)

        total_rows = (len(self.students) + self.cols - 1) // self.cols
        grid = np.zeros((total_rows * self.cell_size, self.cols * self.cell_size, 3), dtype=np.uint8)

        for idx, s in enumerate(self.students):
            row = idx // self.cols
            col = idx % self.cols

            img = s['image']
            h, w = img.shape[:2]
            scale = min(self.cell_size / w, self.cell_size / h) * 0.8
            new_w, new_h = int(w * scale), int(h * scale)
            resized = cv2.resize(img, (new_w, new_h))

            y_off = row * self.cell_size + (self.cell_size - new_h) // 2
            x_off = col * self.cell_size + (self.cell_size - new_w) // 2
            grid[y_off:y_off + new_h, x_off:x_off + new_w] = resized

            name = self.names.get(s['id'], '')
            label = f"{s['id']}:{name[:8]}" if name else f"{s['id']}({s['count']})"
            color = (0, 255, 0) if name else (200, 200, 200)
            cv2.putText(grid, label, (col * self.cell_size + 3, row * self.cell_size + 14),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        return grid


def list_experiments():
    """Показывает все эксперименты."""
    students_dir = Path("students")
    if not students_dir.exists():
        print("No students directory")
        return []

    exps = sorted([d for d in students_dir.iterdir() if d.is_dir() and d.name.startswith("exp")],
                  key=lambda x: int(x.name[3:]) if x.name[3:].isdigit() else 0)

    if not exps:
        print("No experiments found")
        return []

    print("\nExperiments:")
    print("-" * 50)
    for exp in exps:
        # Считаем студентов
        student_count = sum(1 for d in exp.iterdir() if d.is_dir() and d.name.isdigit())
        csv_path = exp / "students.csv"
        has_csv = "+" if csv_path.exists() else "-"
        print(f"  {exp.name:10} - {student_count:3} students  [CSV: {has_csv}]")
    print("-" * 50)

    return exps


def main():
    parser = argparse.ArgumentParser(
        description='Interactive student verification tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python verify_students.py              # latest exp
  python verify_students.py --exp exp22  # specific exp
  python verify_students.py --list       # list all experiments
        """
    )
    parser.add_argument('--exp', type=str, default=None, help='Experiment folder')
    parser.add_argument('--list', '-l', action='store_true', help='List all experiments')
    args = parser.parse_args()

    students_dir = Path("students")

    # Показать список
    if args.list:
        list_experiments()
        return

    # Определяем папку
    if args.exp:
        exp_dir = Path(args.exp)
        if not exp_dir.exists() and not str(args.exp).startswith("students"):
            exp_dir = students_dir / args.exp
    else:
        exp_dir = None

    if exp_dir is None or not exp_dir.exists():
        if students_dir.exists():
            exps = sorted([d for d in students_dir.iterdir() if d.is_dir() and d.name.startswith("exp")],
                         key=lambda x: int(x.name[3:]) if x.name[3:].isdigit() else 0)
            if exps:
                exp_dir = exps[-1]
                print(f"Using latest: {exp_dir}")
            else:
                print("No experiments found. Run extract_students.py first.")
                return
        else:
            print("No students directory")
            return

    print(f"Loading: {exp_dir}")

    verifier = StudentVerifier(exp_dir)
    if not verifier.students:
        print("No students found!")
        return

    print(f"Found {len(verifier.students)} students")
    verifier.run()


if __name__ == "__main__":
    main()
