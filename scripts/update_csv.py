# -*- coding: UTF-8 -*-
"""Update CSV with remaining students"""
import csv
from pathlib import Path

def update_csv(exp_dir):
    exp_dir = Path(exp_dir)
    students = []

    for student_dir in sorted(exp_dir.iterdir(), key=lambda x: int(x.name) if x.name.isdigit() else 999):
        if not student_dir.is_dir() or not student_dir.name.isdigit():
            continue

        student_id = int(student_dir.name)
        photos = list(student_dir.glob("*.jpg"))
        students.append({
            'id': student_id,
            'photos': len(photos),
            'name': ''
        })

    csv_path = exp_dir / "students.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'photos', 'name'])
        writer.writeheader()
        writer.writerows(students)

    print(f"Updated CSV: {csv_path}")
    print(f"Total students: {len(students)}")

if __name__ == "__main__":
    update_csv("students/exp12")
