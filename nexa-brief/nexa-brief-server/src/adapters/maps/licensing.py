class LicenseBlocked(PermissionError):
    """La licencia requiere autorización explícita no comercial."""


def check_license(provider, allow_noncommercial=False):
    if not provider.commercial_ok and not allow_noncommercial:
        raise LicenseBlocked(f'{provider.id}: bloqueado por licencia')
