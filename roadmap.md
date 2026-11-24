# Roadmap

- [x] Sign in with Google or email + password (tiny top-right mark)
- [x] Admin account (admin@admin.com) can edit/delete any code
- [x] Signed-in users can edit/delete only their own codes
- [x] People who add a code without signing in can still edit/delete it (from the same device)
- [x] Codes must start with "NG-" followed by the code
- [x] Remove the 3-second delay between copies
- [x] Next-code card with Copy and Open (opens Nusuk app link, marks code used)
- [x] Pin six codes at the top in a fixed order
- [x] Open link on every code
- [x] Small edit icon at the bottom → select a code, then edit or delete
- [x] Code box: no fixed "NG-" text, reject codes without "NG-"
- [x] "Open" becomes "Copy and open" (copies the code, then opens the app)
- [x] Hide pin icons
- [x] Admin "Fetch more codes" button importing from nusukkey.xyz (add-only, no schedule, 15s limit, last 10 results)
- [ ] Auto-run "Fetch more codes" every 30 min (lock, 6h backoff after 5 failures, admin on/off switch, auto/manual in results)
- [ ] New list order: pinned, shared, bulk, fetched; copied codes at the bottom by copy time (last copied at the very bottom); own new code on top for its owner
