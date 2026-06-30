import re

with open('src/pages/AdminMenuManagement.jsx', 'r') as f:
    content = f.read()

# Find the modal block starting at {menuParams.showItemForm && createPortal( and ending at document.body )}
modal_start = content.find('{menuParams.showItemForm && createPortal(')
modal_end_str = '          document.body\n        )}'
modal_end = content.find(modal_end_str, modal_start) + len(modal_end_str)

if modal_start == -1 or modal_end == -1:
    print("Could not find modal block")
    exit(1)

modal_code = content[modal_start:modal_end]

# Create ProductModal.jsx
modal_jsx = """import React from 'react';
import { createPortal } from 'react-dom';
import { 
    IoClose, IoCube, IoCash, IoFlask, IoBarcodeOutline, IoImageOutline, 
    IoChevronUp, IoChevronDown, IoAddCircleOutline, IoCheckmarkCircle, 
    IoEyeOff, IoTrashOutline 
} from 'react-icons/io5';

const ProductModal = ({
    menuParams,
    t,
    isDark,
    tipoNegocio,
    activeModalTab,
    handleFormScroll,
    scrollToSection,
    sectionGeraisRef,
    sectionPrecosRef,
    sectionFichaRef,
    sectionFiscalRef,
    sectionFotoRef,
    handleFormChange,
    isModoMultiplasVariacoes,
    getTerminology
}) => {
    return createPortal(
""" + modal_code[modal_code.find('<div className="fixed'):modal_code.rfind(',')] + """,
        document.body
    );
};

export default ProductModal;
"""

with open('src/components/admin/menu/ProductModal.jsx', 'w') as f:
    f.write(modal_jsx)

# Replace in AdminMenuManagement.jsx
replacement = """{menuParams.showItemForm && (
          <ProductModal
            menuParams={menuParams}
            t={t}
            isDark={isDark}
            tipoNegocio={tipoNegocio}
            activeModalTab={activeModalTab}
            handleFormScroll={handleFormScroll}
            scrollToSection={scrollToSection}
            sectionGeraisRef={sectionGeraisRef}
            sectionPrecosRef={sectionPrecosRef}
            sectionFichaRef={sectionFichaRef}
            sectionFiscalRef={sectionFiscalRef}
            sectionFotoRef={sectionFotoRef}
            handleFormChange={handleFormChange}
            isModoMultiplasVariacoes={isModoMultiplasVariacoes}
            getTerminology={getTerminology}
          />
        )}"""

new_content = content[:modal_start] + replacement + content[modal_end:]

# Add import statement if not exists
import_stmt = "import ProductModal from '../components/admin/menu/ProductModal.jsx';\n"
if "import ProductModal" not in new_content:
    # insert after the last import
    last_import = new_content.rfind("import ")
    last_import_end = new_content.find("\\n", last_import) + 1
    new_content = new_content[:last_import_end] + import_stmt + new_content[last_import_end:]

with open('src/pages/AdminMenuManagement.jsx', 'w') as f:
    f.write(new_content)

print("Extraction successful")
