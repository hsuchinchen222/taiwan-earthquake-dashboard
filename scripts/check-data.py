#!/usr/bin/env python3
"""Independent, dependency-free checks for the supplied earthquake CSV."""

import csv
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "public" / "data" / "taiwan_major_felt_earthquakes_2024-09-25_to_2026-09-25.csv"
EARTH_RADIUS_KM = 6371.0


def pearson(xs, ys):
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denom_x = sum((x - mean_x) ** 2 for x in xs)
    denom_y = sum((y - mean_y) ** 2 for y in ys)
    return numerator / math.sqrt(denom_x * denom_y)


def average_ranks(values):
    ordered = sorted(enumerate(values), key=lambda pair: pair[1])
    ranks = [0.0] * len(values)
    start = 0
    while start < len(ordered):
        end = start + 1
        while end < len(ordered) and ordered[end][1] == ordered[start][1]:
            end += 1
        rank = ((start + 1) + end) / 2.0
        for index in range(start, end):
            ranks[ordered[index][0]] = rank
        start = end
    return ranks


def haversine_km(left, right):
    lat1, lon1 = map(math.radians, left)
    lat2, lon2 = map(math.radians, right)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(min(1.0, value)))


def component_sizes(points, threshold_km=50):
    parents = list(range(len(points)))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for left in range(len(points)):
        for right in range(left + 1, len(points)):
            if haversine_km(points[left], points[right]) <= threshold_km:
                a, b = find(left), find(right)
                if a != b:
                    parents[b] = a
    counts = Counter(find(index) for index in range(len(points)))
    return sorted(counts.values(), reverse=True)


def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)
    print("PASS:", message)


with CSV_PATH.open(encoding="utf-8-sig", newline="") as source:
    reader = csv.DictReader(source)
    rows = list(reader)

ids = [row["報告編號"].strip() for row in rows]
magnitudes = [float(row["規模_ML"]) for row in rows]
depths = [float(row["深度_km"]) for row in rows]
intensity_ranks = [float(row["最大震度序位_分析用"]) for row in rows]
months = Counter(row["發震時間_TST"][:7] for row in rows)
points = [(float(row["緯度"]), float(row["經度"])) for row in rows]

require(len(rows) == 39, "CSV contains 39 event rows")
require(len(set(ids)) == len(ids), "event IDs are unique")
require(max(magnitudes) == 7.0, "maximum magnitude is M7.0")
max_rank = max(intensity_ranks)
max_intensity = next(row["最大震度"] for row in rows if float(row["最大震度序位_分析用"]) == max_rank)
require(max_intensity == "6弱", "maximum intensity follows the CSV ordinal field (6弱)")
require(max(months, key=months.get) == "2025-01" and months["2025-01"] == 7, "monthly peak is 2025/01 with 7 events")
require(abs(pearson(magnitudes, depths) - 0.4462251866) < 0.00001, "Pearson magnitude-depth r matches the supplied sample")
rho = pearson(average_ranks(magnitudes), average_ranks(intensity_ranks))
require(abs(rho - 0.1560211484) < 0.00001, "Spearman magnitude-intensity rho matches the supplied sample")
require(max(depths) == 113.9, "maximum depth in the CSV is 113.9 km")
require(component_sizes(points) == [19, 13, 5, 1, 1], "50 km connected-component sizes match the source coordinates")

print("CSV data checks passed.")
