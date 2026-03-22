"""
CLI bridge: Node.js calls this script with JSON input on stdin.
Reads QBO mapped data, writes to the P&L template, returns JSON summary on stdout.

Usage:
  echo '{"mapped_data": [...], "template_path": "...", ...}' | python fill_template_cli.py
  OR
  python fill_template_cli.py --input input.json
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from template_writer import (
    col_index,
    map_account_to_row,
    aggregate_to_monthly,
    detect_granularity,
    owner_pay_split,
    get_default_split,
    write_to_template,
)


def main():
    if '--input' in sys.argv:
        idx = sys.argv.index('--input')
        with open(sys.argv[idx + 1], 'r') as f:
            payload = json.load(f)
    else:
        payload = json.load(sys.stdin)

    action = payload.get('action', 'write')

    if action == 'map_and_write':
        return handle_map_and_write(payload)
    elif action == 'write':
        return handle_write(payload)
    elif action == 'fix_only':
        return handle_fix_only(payload)
    elif action == 'map_accounts':
        return handle_map_accounts(payload)
    else:
        output({'error': f'Unknown action: {action}'})
        sys.exit(1)


def handle_map_and_write(payload):
    """
    Full pipeline: take QBO accounts with amounts per month,
    map to template rows, write to template.
    """
    accounts = payload.get('accounts', [])
    template_path = payload.get('template_path')
    output_path = payload.get('output_path')
    overwrite = payload.get('overwrite_existing', False)
    business_type = payload.get('business_type', 'unknown')
    owner_pay_total_monthly = payload.get('owner_pay_monthly', {})
    direct_pct = payload.get('direct_labor_pct', get_default_split(business_type))

    if not template_path or not os.path.exists(template_path):
        output({'error': f'Template not found: {template_path}'})
        sys.exit(1)

    mapped_data = []
    unmapped = []
    flags = []
    mapping_log = []

    for acct in accounts:
        name = acct.get('name', '')
        section = acct.get('section', '')
        monthly = acct.get('monthly', {})

        row, confidence, acct_flags = map_account_to_row(name, section)
        flags.extend(acct_flags)

        if row is None:
            unmapped.append({'name': name, 'section': section, 'monthly': monthly})
            continue

        mapping_log.append({
            'name': name, 'row': row, 'confidence': confidence,
            'label': f"Row {row}", 'flags': acct_flags,
        })

        for month_key, amount in monthly.items():
            parts = month_key.split('-')
            year, month = int(parts[0]), int(parts[1])
            try:
                ci = col_index(year, month)
                mapped_data.append({'row': row, 'col_index': ci, 'value': amount})
            except ValueError:
                pass

    # Owner pay split per month
    for month_key, total in owner_pay_total_monthly.items():
        parts = month_key.split('-')
        year, month = int(parts[0]), int(parts[1])
        try:
            ci = col_index(year, month)
            r29, r70 = owner_pay_split(total, direct_pct)
            mapped_data.append({'row': 29, 'col_index': ci, 'value': r29})
            mapped_data.append({'row': 70, 'col_index': ci, 'value': r70})
        except ValueError:
            pass

    summary = write_to_template(
        template_path, mapped_data,
        overwrite_existing=overwrite,
        fix_known_issues=True,
        output_path=output_path,
    )

    summary['mapping_log'] = mapping_log
    summary['unmapped'] = unmapped
    summary['flags'] = list(set(flags + summary.get('flags', [])))
    output(summary)


def handle_write(payload):
    """Direct write: mapped_data already has row/col_index/value."""
    mapped_data = payload.get('mapped_data', [])
    template_path = payload.get('template_path')
    output_path = payload.get('output_path')
    overwrite = payload.get('overwrite_existing', False)

    if not template_path or not os.path.exists(template_path):
        output({'error': f'Template not found: {template_path}'})
        sys.exit(1)

    summary = write_to_template(
        template_path, mapped_data,
        overwrite_existing=overwrite,
        fix_known_issues=True,
        output_path=output_path,
    )
    output(summary)


def handle_fix_only(payload):
    """Apply fixes to template without writing data."""
    from fix_template import fix_all_issues
    template_path = payload.get('template_path')
    if not template_path or not os.path.exists(template_path):
        output({'error': f'Template not found: {template_path}'})
        sys.exit(1)
    issues = fix_all_issues(template_path, save=True)
    output({'issues_fixed': issues})


def handle_map_accounts(payload):
    """Map QBO account names to template rows without writing."""
    accounts = payload.get('accounts', [])
    results = []
    for acct in accounts:
        name = acct.get('name', '')
        section = acct.get('section', '')
        row, confidence, flags = map_account_to_row(name, section)
        results.append({
            'name': name, 'row': row, 'confidence': confidence,
            'flags': flags, 'section': section,
        })
    output({'mappings': results})


def output(data):
    print(json.dumps(data, default=str))


if __name__ == '__main__':
    main()
