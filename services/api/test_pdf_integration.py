#!/usr/bin/env python3
"""
Integration test for PDF generation

This script tests the PDF generation feature end-to-end:
1. Validates PDF service initialization
2. Tests template rendering
3. Generates sample PDF
4. Validates PDF output
"""
import sys
from pathlib import Path
from datetime import date
from decimal import Decimal

# Ensure app is in path
sys.path.insert(0, str(Path(__file__).parent / "app"))

try:
    from app.services.pdf_generator import pdf_generator
    from app.utils.pdf_helpers import (
        prepare_ticket_data_for_pdf,
        prepare_project_data_for_pdf,
        sanitize_pdf_filename
    )
    from app.core.config import settings
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("This script should be run inside the Docker container")
    sys.exit(1)


# Sample test data matching real database structure
class MockLaborItem:
    def __init__(self, description, hours, labor_type, rate_per_hour):
        self.description = description
        self.hours = Decimal(str(hours))
        self.labor_type = MockEnum(labor_type)
        self.rate_per_hour = Decimal(str(rate_per_hour))
        self.subtotal = self.hours * self.rate_per_hour


class MockMaterialItem:
    def __init__(self, description, quantity, unit, unit_price):
        self.description = description
        self.quantity = Decimal(str(quantity))
        self.unit = unit
        self.unit_price = Decimal(str(unit_price))
        self.subtotal = self.quantity * self.unit_price


class MockEquipmentItem:
    def __init__(self, description, quantity, unit, unit_price):
        self.description = description
        self.quantity = Decimal(str(quantity))
        self.unit = unit
        self.unit_price = Decimal(str(unit_price))
        self.subtotal = self.quantity * self.unit_price


class MockSubcontractorItem:
    def __init__(self, description, subcontractor_name, proposal_date, amount):
        self.description = description
        self.subcontractor_name = subcontractor_name
        self.proposal_date = proposal_date
        self.amount = Decimal(str(amount))


class MockEnum:
    def __init__(self, value):
        self.value = value


class MockProject:
    def __init__(self):
        self.name = "Downtown Office Building Renovation"
        self.project_number = "PRJ-2025-042"


class MockTicket:
    def __init__(self):
        self.tnm_number = "PRJ-2025-042-TNM-001"
        self.rfco_number = "RFCO-001"
        self.title = "Additional Electrical Work Required"
        self.description = "Install additional power outlets and circuit breakers for new equipment area as requested by client."
        self.proposal_date = date(2025, 10, 15)
        self.submitter_name = "John Foreman"
        self.submitter_email = "john.foreman@example.com"
        self.notes = "All materials are in stock. Work can begin immediately upon approval."

        # Line items
        self.labor_items = [
            MockLaborItem("Electrician - Install outlets and run conduit", 16.00, "carpenter", 75.00),
            MockLaborItem("Laborer - Assist with installation", 8.00, "laborer", 57.00),
        ]
        self.material_items = [
            MockMaterialItem("20A Duplex Outlet", 12, "EA", 15.50),
            MockMaterialItem("3/4\" EMT Conduit", 150, "FT", 2.25),
            MockMaterialItem("20A Circuit Breaker", 6, "EA", 45.00),
        ]
        self.equipment_items = [
            MockEquipmentItem("Conduit Bender Rental", 3, "DAY", 85.00),
        ]
        self.subcontractor_items = [
            MockSubcontractorItem(
                "Panel Upgrade and Inspection",
                "ABC Electrical Services",
                date(2025, 10, 12),
                1500.00
            ),
        ]

        # Totals
        self.labor_subtotal = Decimal("1656.00")
        self.labor_ohp_percent = Decimal("20.00")
        self.labor_total = Decimal("1987.20")

        self.material_subtotal = Decimal("793.50")
        self.material_ohp_percent = Decimal("15.00")
        self.material_total = Decimal("912.53")

        self.equipment_subtotal = Decimal("255.00")
        self.equipment_ohp_percent = Decimal("10.00")
        self.equipment_total = Decimal("280.50")

        self.subcontractor_subtotal = Decimal("1500.00")
        self.subcontractor_ohp_percent = Decimal("5.00")
        self.subcontractor_total = Decimal("1575.00")

        self.proposal_amount = Decimal("4755.23")

        self.project = MockProject()


def test_configuration():
    """Test that configuration is loaded correctly"""
    print("\n1️⃣ Testing Configuration...")
    print(f"   Company Name: {settings.COMPANY_NAME}")
    print(f"   Company Email: {settings.COMPANY_EMAIL}")
    print(f"   Company Phone: {settings.COMPANY_PHONE}")
    print("   ✅ Configuration loaded")


def test_pdf_service():
    """Test PDF service initialization"""
    print("\n2️⃣ Testing PDF Service...")
    print(f"   Template Dir: {pdf_generator.template_dir}")
    print(f"   Template Exists: {pdf_generator.template_dir.exists()}")

    # Check for template file
    template_file = pdf_generator.template_dir / "rfco_pdf.html"
    if not template_file.exists():
        print(f"   ❌ Template not found: {template_file}")
        return False

    print(f"   Template File: {template_file}")
    print("   ✅ PDF service initialized")
    return True


def test_helper_functions():
    """Test helper functions"""
    print("\n3️⃣ Testing Helper Functions...")

    ticket = MockTicket()

    # Test data preparation
    ticket_data = prepare_ticket_data_for_pdf(ticket)
    print(f"   Ticket data prepared: {len(ticket_data)} fields")

    project_data = prepare_project_data_for_pdf(ticket.project)
    print(f"   Project data prepared: {len(project_data)} fields")

    # Test filename sanitization
    unsafe_name = "TNM/001\\Test\"File"
    safe_name = sanitize_pdf_filename(unsafe_name)
    print(f"   Filename sanitized: '{unsafe_name}' -> '{safe_name}'")

    print("   ✅ Helper functions working")
    return ticket_data, project_data


def test_pdf_generation(ticket_data, project_data):
    """Test actual PDF generation"""
    print("\n4️⃣ Testing PDF Generation...")

    try:
        output_path = "/tmp/test_rfco_integration.pdf"
        pdf_content = pdf_generator.generate_rfco_pdf(
            ticket_data,
            project_data,
            output_path=output_path
        )

        print(f"   ✅ PDF generated successfully")
        print(f"   Size: {len(pdf_content):,} bytes")
        print(f"   Saved to: {output_path}")

        # Validate PDF header
        if pdf_content[:4] == b'%PDF':
            print("   ✅ Valid PDF file header")
        else:
            print("   ❌ Invalid PDF file header")
            return False

        return True

    except Exception as e:
        print(f"   ❌ Error generating PDF: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_edge_cases():
    """Test edge cases"""
    print("\n5️⃣ Testing Edge Cases...")

    # Test with minimal data
    minimal_ticket = {
        'tnm_number': 'TEST-001',
        'title': 'Minimal Test',
        'proposal_amount': 100.00,
        'proposal_date': date.today(),
        'submitter_name': 'Test User',
        'submitter_email': 'test@example.com',
        'labor_items': [],
        'material_items': [],
        'equipment_items': [],
        'subcontractor_items': [],
        'labor_subtotal': 0,
        'labor_ohp_percent': 0,
        'labor_total': 0,
        'material_subtotal': 0,
        'material_ohp_percent': 0,
        'material_total': 0,
        'equipment_subtotal': 0,
        'equipment_ohp_percent': 0,
        'equipment_total': 0,
        'subcontractor_subtotal': 0,
        'subcontractor_ohp_percent': 0,
        'subcontractor_total': 0,
    }

    minimal_project = {
        'name': 'Test Project',
        'project_number': 'TEST-001',
    }

    try:
        pdf_content = pdf_generator.generate_rfco_pdf(
            minimal_ticket,
            minimal_project
        )
        print(f"   ✅ Minimal data test passed ({len(pdf_content):,} bytes)")
        return True
    except Exception as e:
        print(f"   ❌ Minimal data test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 70)
    print("PDF Generation Integration Test")
    print("=" * 70)

    all_passed = True

    try:
        # Test 1: Configuration
        test_configuration()

        # Test 2: PDF Service
        if not test_pdf_service():
            all_passed = False

        # Test 3: Helper Functions
        ticket_data, project_data = test_helper_functions()

        # Test 4: PDF Generation
        if not test_pdf_generation(ticket_data, project_data):
            all_passed = False

        # Test 5: Edge Cases
        if not test_edge_cases():
            all_passed = False

    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    # Summary
    print("\n" + "=" * 70)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("=" * 70)
        print("\nPDF generation is working correctly!")
        print("You can find the test PDF at: /tmp/test_rfco_integration.pdf")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("=" * 70)
        return 1


if __name__ == '__main__':
    sys.exit(main())
