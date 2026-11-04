
import rasterio
import numpy as np
import matplotlib.pyplot as plt

SATELLITE_PATH = "data/samples/satellite.tif"
TERRAIN_PATH = "outputs/terrain_dem.tif"

with rasterio.open(SATELLITE_PATH) as sat:
    rgb = sat.read([1, 2, 3])
    rgb = np.moveaxis(rgb, 0, -1)

with rasterio.open(TERRAIN_PATH) as terrain:
    elevation = terrain.read(1, masked=True)

fig, axes = plt.subplots(1, 2, figsize=(14, 6))

axes[0].imshow(rgb)
axes[0].set_title("Satellite Image")
axes[0].axis("off")

image = axes[1].imshow(elevation, cmap="terrain")
axes[1].set_title("Aligned Terrain Elevation")
axes[1].axis("off")

fig.colorbar(image, ax=axes[1], label="Elevation (check units)")

plt.tight_layout()
plt.show()
