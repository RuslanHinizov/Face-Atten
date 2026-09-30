# -*- coding: UTF-8 -*-
"""Grid search для подбора CLUSTERING_THRESHOLD."""
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed

VIDEO = "test_428.mp4"
THRESHOLDS = [0.51, 0.52, 0.53]
PARALLEL = 3  # Сколько запускать параллельно


def run_extraction(threshold):
    """Запускает extract_students.py с заданным threshold."""
    cmd = [sys.executable, "extract_students.py", VIDEO, "-t", str(threshold)]
    print(f"\n[START] threshold={threshold}")

    # Запускаем и показываем вывод в реальном времени
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, bufsize=1)

    stdout_lines = []
    students = "?"

    for line in process.stdout:
        line = line.rstrip()
        stdout_lines.append(line)
        # Показываем только важные строки
        if "Processing:" in line or "RESULTS" in line or "Students" in line:
            print(f"[t={threshold}] {line}")
        if "Students found:" in line:
            students = line.split(":")[-1].strip()
        elif "Students:" in line and "found" not in line:
            students = line.split(":")[-1].strip()

    process.wait()
    print(f"[DONE] threshold={threshold} → students={students}")
    return threshold, students, "\n".join(stdout_lines)


def main():
    print(f"Grid search: {THRESHOLDS}")
    print(f"Parallel: {PARALLEL}")
    print("=" * 50)

    results = []

    # Запускаем по PARALLEL штук параллельно
    with ProcessPoolExecutor(max_workers=PARALLEL) as executor:
        futures = {executor.submit(run_extraction, t): t for t in THRESHOLDS}

        for future in as_completed(futures):
            threshold, students, stdout = future.result()
            results.append((threshold, students))

    # Итоговая таблица
    print("\n" + "=" * 50)
    print("RESULTS")
    print("=" * 50)
    print(f"{'Threshold':<12} {'Students':<10}")
    print("-" * 22)

    for threshold, students in sorted(results):
        print(f"{threshold:<12} {students:<10}")

    print("=" * 50)


if __name__ == "__main__":
    main()
