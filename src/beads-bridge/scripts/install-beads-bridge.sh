#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO="wellmaintained/skills"
BINARY_NAME="beads-bridge"

# Detect platform and architecture
detect_platform() {
    local os="$(uname -s)"
    local arch="$(uname -m)"

    case "$os" in
        Linux*)
            PLATFORM="linux"
            ;;
        Darwin*)
            PLATFORM="darwin"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            PLATFORM="win32"
            ;;
        *)
            echo -e "${RED}Error: Unsupported operating system: $os${NC}"
            exit 1
            ;;
    esac

    case "$arch" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $arch${NC}"
            exit 1
            ;;
    esac

    # Construct binary filename
    if [ "$PLATFORM" = "win32" ]; then
        BINARY_FILENAME="${BINARY_NAME}-${PLATFORM}-${ARCH}.exe"
    else
        BINARY_FILENAME="${BINARY_NAME}-${PLATFORM}-${ARCH}"
    fi

    echo -e "${GREEN}Detected platform: ${PLATFORM}-${ARCH}${NC}"
}

# Determine install directory
determine_install_dir() {
    # If install directory provided as argument, use it
    if [ -n "$1" ]; then
        INSTALL_DIR="$1"
        echo -e "${YELLOW}Using provided install directory: ${INSTALL_DIR}${NC}"
        return
    fi

    # Otherwise, find a suitable directory in PATH
    # Prioritize user-writable locations
    local preferred_dirs=(
        "$HOME/.local/bin"
        "$HOME/bin"
        "/usr/local/bin"
    )

    for dir in "${preferred_dirs[@]}"; do
        # Check if directory exists or can be created
        if [ -d "$dir" ] || mkdir -p "$dir" 2>/dev/null; then
            # Check if directory is in PATH
            if echo "$PATH" | tr ':' '\n' | grep -q "^${dir}$"; then
                INSTALL_DIR="$dir"
                echo -e "${GREEN}Installing to: ${INSTALL_DIR}${NC}"
                return
            fi
        fi
    done

    # Fallback to ~/.local/bin and add to PATH warning
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    echo -e "${YELLOW}Installing to: ${INSTALL_DIR}${NC}"
    echo -e "${YELLOW}Warning: ${INSTALL_DIR} is not in your PATH${NC}"
    echo -e "${YELLOW}Add it by running: export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
}

# Get latest release version
get_latest_version() {
    echo -e "${YELLOW}Fetching latest release version...${NC}"

    # Try to get latest release from GitHub API
    VERSION=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

    if [ -z "$VERSION" ]; then
        echo -e "${RED}Error: Could not fetch latest version${NC}"
        exit 1
    fi

    echo -e "${GREEN}Latest version: ${VERSION}${NC}"
}

# Download binary
download_binary() {
    local download_url="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_FILENAME}"
    local temp_file="/tmp/${BINARY_FILENAME}"

    echo -e "${YELLOW}Downloading ${BINARY_FILENAME}...${NC}"
    echo -e "${YELLOW}URL: ${download_url}${NC}"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "${download_url}" -o "${temp_file}"
    elif command -v wget >/dev/null 2>&1; then
        wget -q "${download_url}" -O "${temp_file}"
    else
        echo -e "${RED}Error: Neither curl nor wget is available${NC}"
        exit 1
    fi

    if [ ! -f "${temp_file}" ]; then
        echo -e "${RED}Error: Download failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}Download complete${NC}"
}

# Install binary
install_binary() {
    local temp_file="/tmp/${BINARY_FILENAME}"
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"

    # Add .exe extension for Windows
    if [ "$PLATFORM" = "win32" ]; then
        install_path="${install_path}.exe"
    fi

    echo -e "${YELLOW}Installing to ${install_path}...${NC}"

    # Create install directory if it doesn't exist
    mkdir -p "${INSTALL_DIR}"

    # Move binary to install location
    mv "${temp_file}" "${install_path}"

    # Make binary executable (not needed on Windows)
    if [ "$PLATFORM" != "win32" ]; then
        chmod +x "${install_path}"
    fi

    echo -e "${GREEN}✓ Binary installed successfully to ${install_path}${NC}"
}

# Verify installation
verify_installation() {
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"

    if [ "$PLATFORM" = "win32" ]; then
        install_path="${install_path}.exe"
    fi

    if [ -f "${install_path}" ]; then
        if [ "$PLATFORM" != "win32" ] && [ -x "${install_path}" ]; then
            echo -e "${GREEN}✓ Installation verified${NC}"

            # Check if command is in PATH
            if command -v beads-bridge >/dev/null 2>&1; then
                echo -e "${GREEN}✓ beads-bridge is available in PATH${NC}"
                echo -e "${GREEN}Run: beads-bridge --version${NC}"
            else
                echo -e "${YELLOW}⚠ beads-bridge not found in PATH${NC}"
                echo -e "${YELLOW}Run directly: ${install_path} --version${NC}"
            fi
            return 0
        elif [ "$PLATFORM" = "win32" ] && [ -f "${install_path}" ]; then
            echo -e "${GREEN}✓ Installation verified${NC}"
            echo -e "${GREEN}Run: ${install_path} --version${NC}"
            return 0
        fi
    fi

    echo -e "${RED}✗ Installation verification failed${NC}"
    return 1
}

# Main execution
main() {
    local install_dir="${1:-}"

    echo -e "${GREEN}=== beads-bridge Binary Installer ===${NC}"

    detect_platform
    determine_install_dir "${install_dir}"
    get_latest_version
    download_binary
    install_binary
    verify_installation

    echo -e "${GREEN}=== Installation complete! ===${NC}"
}

# Run main with optional install directory argument
main "$@"
