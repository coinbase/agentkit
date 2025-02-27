import re


# Port of viem's parseUnits:
# https://github.com/wevm/viem/blob/217586d97146db12f4044738f06260fcc2fff0c3/src/utils/unit/parseUnits.ts
def parse_units(value: str, decimals: int) -> int:
    """Multiplies a string representation of a number by a given exponent of base 10 (10exponent)."""
    if not re.match(r"^(-?)([0-9]*)\.?([0-9]*)$", value):
        raise ValueError(f"Invalid decimal number: {value}")

    parts = value.split(".")
    integer = parts[0]
    fraction = parts[1] if len(parts) > 1 else "0"

    negative = integer.startswith("-")
    if negative:
        integer = integer[1:]

    fraction = fraction.rstrip("0")

    if decimals == 0:
        if fraction and round(float(f"0.{fraction}")) == 1:
            integer = str(int(integer) + 1)
        fraction = ""
    elif len(fraction) > decimals:
        left = fraction[: decimals - 1]
        unit = fraction[decimals - 1 : decimals]
        right = fraction[decimals:]

        rounded = round(float(f"{unit}.{right}"))

        fraction = str(int(left) + 1).zfill(len(left) + 1) if rounded > 9 else f"{left}{rounded}"

        if len(fraction) > decimals:
            fraction = fraction[1:]
            integer = str(int(integer) + 1)

        fraction = fraction[:decimals]
    else:
        fraction = fraction.ljust(decimals, "0")

    result = f"{'-' if negative else ''}{integer}{fraction}"
    return int(result)
